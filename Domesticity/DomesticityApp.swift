import SwiftData
import SwiftUI
import UserNotifications

@main
struct DomesticityApp: App {
    @UIApplicationDelegateAdaptor private var appDelegate: AppDelegate

    var body: some Scene {
        WindowGroup {
            RootView()
        }
        .modelContainer(Store.container)
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        Reminders.registerCategories()
        return true
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .list, .sound])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let info = response.notification.request.content.userInfo
        if response.actionIdentifier == Reminders.doneActionID,
           let raw = info["choreID"] as? String, let id = UUID(uuidString: raw) {
            Task { @MainActor in
                Store.markDone(choreID: id)
                completionHandler()
            }
        } else {
            completionHandler()
        }
    }
}

struct RootView: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.modelContext) private var context
    /// Remembered between launches; `-selectedTab progress` on the command line overrides it.
    @AppStorage("selectedTab") private var selectedTab = "today"

    var body: some View {
        TabView(selection: $selectedTab) {
            Tab("Today", systemImage: "checklist", value: "today") { TodayView() }
            Tab("Routines", systemImage: "square.grid.2x2", value: "routines") { ChoresView() }
            Tab("Progress", systemImage: "chart.bar.xaxis", value: "progress") { StatsView() }
            Tab("Household", systemImage: "house", value: "household") { HouseholdView() }
        }
        .task {
            #if DEBUG
            DemoData.seedIfRequested(in: context)
            if CommandLine.arguments.contains("-demo") {
                Store.refreshReminders(in: context)
                return
            }
            #endif
            await Reminders.requestAuthorization()
            Store.refreshReminders(in: context)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Store.refreshReminders(in: context) }
        }
    }
}
