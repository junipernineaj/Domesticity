import Foundation
import SwiftData

@MainActor
enum Store {
    static let container: ModelContainer = {
        let schema = Schema([Chore.self, Completion.self, Member.self])
        let config = ModelConfiguration(schema: schema, cloudKitDatabase: .none)
        do {
            return try ModelContainer(for: schema, configurations: [config])
        } catch {
            fatalError("Could not open the Domesticity database: \(error)")
        }
    }()

    static let currentMemberKey = "currentMemberID"

    static func currentMember(in context: ModelContext) -> Member? {
        guard let raw = UserDefaults.standard.string(forKey: currentMemberKey),
              let id = UUID(uuidString: raw) else { return nil }
        return try? context.fetch(FetchDescriptor<Member>(predicate: #Predicate { $0.uuid == id })).first
    }

    static func complete(_ chore: Chore, by member: Member?, skipped: Bool = false, in context: ModelContext) {
        let completion = Completion(date: .now, dueDate: chore.nextDue(), skipped: skipped)
        context.insert(completion)
        completion.chore = chore
        completion.member = skipped ? nil : member
        save(context)
    }

    /// Saves and brings reminders in line with the new state. Route every change through here.
    static func save(_ context: ModelContext) {
        try? context.save()
        refreshReminders(in: context)
    }

    static func refreshReminders(in context: ModelContext) {
        let chores = (try? context.fetch(FetchDescriptor<Chore>())) ?? []
        Reminders.reschedule(chores)
    }

    /// Handles the "Mark done" action on a reminder.
    static func markDone(choreID: UUID) {
        let context = container.mainContext
        let descriptor = FetchDescriptor<Chore>(predicate: #Predicate { $0.uuid == choreID })
        guard let chore = try? context.fetch(descriptor).first else { return }
        complete(chore, by: currentMember(in: context), in: context)
    }
}
