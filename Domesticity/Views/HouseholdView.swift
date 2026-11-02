import SwiftData
import SwiftUI
import UserNotifications

struct HouseholdView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.openURL) private var openURL
    @Environment(\.scenePhase) private var scenePhase
    @Query(sort: \Member.createdAt) private var members: [Member]
    @AppStorage(Store.currentMemberKey) private var currentMemberID = ""

    @State private var addingMember = false
    @State private var newName = ""
    @State private var notificationStatus: UNAuthorizationStatus?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("This phone belongs to", selection: $currentMemberID) {
                        Text("Not set").tag("")
                        ForEach(members) { Text($0.name).tag($0.uuid.uuidString) }
                    }
                } footer: {
                    Text("Jobs ticked off on this phone are credited to this person. To credit someone else, long-press a routine on Today.")
                }

                Section("People") {
                    ForEach(members) { member in
                        NavigationLink {
                            MemberEditor(member: member)
                        } label: {
                            HStack(spacing: 12) {
                                MemberBadge(member: member, size: 30)
                                Text(member.name)
                                Spacer()
                                Text("\((member.completions ?? []).filter { !$0.skipped }.count) done")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .onDelete { offsets in
                        for index in offsets {
                            if members[index].uuid.uuidString == currentMemberID { currentMemberID = "" }
                            context.delete(members[index])
                        }
                        Store.save(context)
                    }
                    Button("Add person", systemImage: "person.badge.plus") {
                        newName = ""
                        addingMember = true
                    }
                }

                Section {
                    switch notificationStatus {
                    case .authorized, .provisional, .ephemeral:
                        Label("Reminders are on", systemImage: "bell.badge")
                    case .denied:
                        Label("Reminders are turned off", systemImage: "bell.slash")
                        Button("Open Settings") {
                            if let url = URL(string: UIApplication.openNotificationSettingsURLString) { openURL(url) }
                        }
                    default:
                        Button("Turn on reminders", systemImage: "bell") {
                            Task {
                                await Reminders.requestAuthorization()
                                Store.refreshReminders(in: context)
                                await refreshStatus()
                            }
                        }
                    }
                } header: {
                    Text("Reminders")
                } footer: {
                    Text("Each routine nudges you at its reminder time on the day it's due, then once a day while it's overdue. You can also mark it done straight from the notification.")
                }

                Section {
                    Text("For now, everyone's progress is kept on this phone. Syncing between household members' own phones over iCloud is planned next.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                } header: {
                    Text("Sharing")
                }
            }
            .navigationTitle("Household")
            .alert("Add person", isPresented: $addingMember) {
                TextField("Name", text: $newName)
                Button("Add", action: addMember)
                Button("Cancel", role: .cancel) {}
            }
            .task { await refreshStatus() }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active { Task { await refreshStatus() } }
            }
        }
    }

    private func addMember() {
        let name = newName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        let colors = MemberColor.allCases
        let member = Member(name: name, colorName: colors[members.count % colors.count].rawValue)
        context.insert(member)
        if currentMemberID.isEmpty { currentMemberID = member.uuid.uuidString }
        Store.save(context)
    }

    private func refreshStatus() async {
        notificationStatus = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }
}

private struct MemberEditor: View {
    @Bindable var member: Member
    @Environment(\.modelContext) private var context

    var body: some View {
        Form {
            Section {
                HStack {
                    Spacer()
                    MemberBadge(member: member, size: 72)
                    Spacer()
                }
                .listRowBackground(Color.clear)
            }
            Section("Name") {
                TextField("Name", text: $member.name)
            }
            Section("Colour") {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 12) {
                    ForEach(MemberColor.allCases) { option in
                        Circle()
                            .fill(option.color)
                            .frame(width: 40, height: 40)
                            .overlay {
                                if option.rawValue == member.colorName {
                                    Image(systemName: "checkmark").font(.headline).foregroundStyle(.white)
                                }
                            }
                            .onTapGesture { member.colorName = option.rawValue }
                            .accessibilityLabel(option.rawValue)
                            .accessibilityAddTraits(.isButton)
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .navigationTitle(member.name.isEmpty ? "Person" : member.name)
        .onDisappear { Store.save(context) }
    }
}
