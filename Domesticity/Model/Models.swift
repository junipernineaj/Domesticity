import Foundation
import SwiftData

// Every stored property has a default and every relationship is optional so the
// schema stays compatible with CloudKit sync when household sharing is added.

enum ScheduleKind: String, CaseIterable, Identifiable {
    /// Due a fixed number of days after it was last done.
    case interval
    /// Due on chosen weekdays, whenever it was last done.
    case weekly
    /// Due on a chosen day of the month.
    case monthly

    var id: String { rawValue }

    var label: String {
        switch self {
        case .interval: "Every N days"
        case .weekly: "Weekly"
        case .monthly: "Monthly"
        }
    }
}

@Model
final class Chore {
    var uuid: UUID = UUID()
    var title: String = ""
    var symbol: String = "sparkles"
    var room: String = "General"
    var notes: String = ""

    var kindRaw: String = ScheduleKind.interval.rawValue
    var intervalDays: Int = 7
    /// Bit (weekday - 1) is set for each chosen weekday; weekday 1 is Sunday, as in `Calendar`.
    var weekdayMask: Int = 0
    var dayOfMonth: Int = 1
    /// First due date for interval routines; the earliest a calendar routine can come up.
    var startDate: Date = Date.now

    var remindersOn: Bool = true
    var reminderHour: Int = 9
    var reminderMinute: Int = 0

    var isPaused: Bool = false
    var createdAt: Date = Date.now

    var assignee: Member?

    @Relationship(deleteRule: .cascade, inverse: \Completion.chore)
    var completions: [Completion]? = []

    init(title: String, symbol: String = "sparkles", room: String = "General") {
        self.title = title
        self.symbol = symbol
        self.room = room
    }
}

@Model
final class Completion {
    var uuid: UUID = UUID()
    var date: Date = Date.now
    /// The due date this completion satisfied, captured when it was recorded.
    var dueDate: Date = Date.now
    /// Skipped completions move the schedule on but don't count towards stats.
    var skipped: Bool = false

    var chore: Chore?
    var member: Member?

    init(date: Date, dueDate: Date, skipped: Bool = false) {
        self.date = date
        self.dueDate = dueDate
        self.skipped = skipped
    }

    var isOnTime: Bool {
        !skipped && Calendar.current.startOfDay(for: date) <= dueDate
    }
}

@Model
final class Member {
    var uuid: UUID = UUID()
    var name: String = ""
    var colorName: String = MemberColor.blue.rawValue
    var createdAt: Date = Date.now

    @Relationship(deleteRule: .nullify, inverse: \Chore.assignee)
    var assignedChores: [Chore]? = []

    @Relationship(deleteRule: .nullify, inverse: \Completion.member)
    var completions: [Completion]? = []

    init(name: String, colorName: String) {
        self.name = name
        self.colorName = colorName
    }
}
