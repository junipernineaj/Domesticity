import Foundation
import UserNotifications

@MainActor
enum Reminders {
    static let categoryID = "CHORE_DUE"
    static let doneActionID = "MARK_DONE"

    private static var center: UNUserNotificationCenter { .current() }

    static func registerCategories() {
        let done = UNNotificationAction(identifier: doneActionID, title: "Mark done", options: [])
        let category = UNNotificationCategory(identifier: categoryID, actions: [done], intentIdentifiers: [])
        center.setNotificationCategories([category])
    }

    @discardableResult
    static func requestAuthorization() async -> Bool {
        (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    /// Replaces every pending reminder. Each routine gets a nudge on its due day and a
    /// follow-up the day after; overdue routines nag daily until done. iOS keeps at most
    /// 64 pending notifications, so only the soonest are scheduled.
    static func reschedule(_ chores: [Chore], now: Date = .now) {
        let cal = Calendar.current
        var pending: [(fire: Date, request: UNNotificationRequest)] = []
        var dueCount = 0

        for chore in chores where !chore.isPaused {
            let days = chore.daysUntilDue(from: now)
            if days <= 0 { dueCount += 1 }
            guard chore.remindersOn else { continue }

            let due = chore.nextDue()
            let fireOnDue = cal.date(bySettingHour: chore.reminderHour, minute: chore.reminderMinute, second: 0, of: due)!
            let id = chore.uuid.uuidString

            if fireOnDue > now {
                pending.append((fireOnDue, request(id: "\(id)-due", chore: chore,
                                                   body: "Due today · \(chore.room)", at: fireOnDue, repeats: false)))
                let followUp = cal.date(byAdding: .day, value: 1, to: fireOnDue)!
                pending.append((followUp, request(id: "\(id)-late", chore: chore,
                                                  body: "Still to do – it was due yesterday", at: followUp, repeats: false)))
            } else {
                var next = cal.date(bySettingHour: chore.reminderHour, minute: chore.reminderMinute, second: 0, of: now)!
                if next <= now { next = cal.date(byAdding: .day, value: 1, to: next)! }
                let since = due.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated))
                pending.append((next, request(id: "\(id)-overdue", chore: chore,
                                              body: "Overdue – was due \(since)", at: next, repeats: true)))
            }
        }

        center.removeAllPendingNotificationRequests()
        for item in pending.sorted(by: { $0.fire < $1.fire }).prefix(60) {
            center.add(item.request)
        }
        center.setBadgeCount(dueCount)
    }

    private static func request(id: String, chore: Chore, body: String, at fire: Date, repeats: Bool) -> UNNotificationRequest {
        let content = UNMutableNotificationContent()
        content.title = chore.title
        content.body = body
        content.sound = .default
        content.categoryIdentifier = categoryID
        content.threadIdentifier = "chores"
        content.userInfo = ["choreID": chore.uuid.uuidString]

        let components: Set<Calendar.Component> = repeats ? [.hour, .minute] : [.year, .month, .day, .hour, .minute]
        let trigger = UNCalendarNotificationTrigger(
            dateMatching: Calendar.current.dateComponents(components, from: fire), repeats: repeats)
        return UNNotificationRequest(identifier: id, content: content, trigger: trigger)
    }
}
