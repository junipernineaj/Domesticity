#if DEBUG
import Foundation
import SwiftData

/// Fills an empty store with a household and a couple of months of history.
/// Launch with the `-demo` argument to use it.
@MainActor
enum DemoData {
    static func seedIfRequested(in context: ModelContext) {
        guard CommandLine.arguments.contains("-demo"),
              (try? context.fetchCount(FetchDescriptor<Chore>())) == 0 else { return }

        let cal = Calendar.current
        let today = cal.startOfDay(for: .now)
        let alex = Member(name: "Alex", colorName: MemberColor.teal.rawValue)
        let sam = Member(name: "Sam", colorName: MemberColor.orange.rawValue)
        context.insert(alex)
        context.insert(sam)
        UserDefaults.standard.set(alex.uuid.uuidString, forKey: Store.currentMemberKey)

        var rng = SystemRandomNumberGenerator()
        for (index, template) in ChoreTemplate.all.prefix(14).enumerated() {
            let chore = Chore(title: template.title, symbol: template.symbol, room: template.room)
            chore.kind = template.kind
            chore.intervalDays = template.intervalDays
            chore.dayOfMonth = template.dayOfMonth
            chore.startDate = cal.date(byAdding: .day, value: -70, to: today)!
            chore.assignee = index.isMultiple(of: 3) ? sam : nil
            context.insert(chore)

            // Replay history: each time it falls due, do it up to a few days late.
            var day = chore.nextDue()
            while true {
                let lateness = [0, 0, 0, 0, -1, 1, 2, 4].randomElement(using: &rng)!
                let doneOn = cal.date(byAdding: .day, value: lateness, to: day)!
                guard doneOn < today else { break }
                let completion = Completion(date: doneOn.addingTimeInterval(18 * 3600), dueDate: day)
                context.insert(completion)
                completion.chore = chore
                completion.member = Bool.random(using: &rng) ? alex : sam
                day = chore.nextDue()
            }
        }
        try? context.save()
    }
}
#endif
