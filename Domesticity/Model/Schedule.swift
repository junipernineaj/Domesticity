import Foundation

extension Chore {
    var kind: ScheduleKind {
        get { ScheduleKind(rawValue: kindRaw) ?? .interval }
        set { kindRaw = newValue.rawValue }
    }

    var weekdays: Set<Int> {
        get { Set((1...7).filter { weekdayMask & (1 << ($0 - 1)) != 0 }) }
        set { weekdayMask = newValue.reduce(0) { $0 | (1 << ($1 - 1)) } }
    }

    var history: [Completion] {
        (completions ?? []).sorted { $0.date > $1.date }
    }

    var lastCompletion: Completion? {
        completions?.max { $0.date < $1.date }
    }

    var lastDone: Completion? {
        completions?.filter { !$0.skipped }.max { $0.date < $1.date }
    }

    /// The start of the day this routine is next due.
    func nextDue(calendar cal: Calendar = .current) -> Date {
        let start = cal.startOfDay(for: startDate)
        let last = lastCompletion

        switch kind {
        case .interval:
            guard let last else { return start }
            return cal.date(byAdding: .day, value: max(1, intervalDays), to: cal.startOfDay(for: last.date))!

        case .weekly, .monthly:
            // A completion covers the slot that was due when it was recorded (so doing
            // Monday's job on Sunday still counts), and the next slot comes after both.
            var from = start
            if let last {
                let covered = max(cal.startOfDay(for: last.date), last.dueDate)
                from = max(from, cal.date(byAdding: .day, value: 1, to: covered)!)
            }
            return kind == .weekly
                ? weeklySlot(onOrAfter: from, calendar: cal)
                : Self.monthlySlot(onOrAfter: from, day: dayOfMonth, calendar: cal)
        }
    }

    private func weeklySlot(onOrAfter from: Date, calendar cal: Calendar) -> Date {
        let days = weekdays.isEmpty ? [cal.component(.weekday, from: startDate)] : weekdays
        for offset in 0..<7 {
            let day = cal.date(byAdding: .day, value: offset, to: from)!
            if days.contains(cal.component(.weekday, from: day)) { return day }
        }
        return from
    }

    /// Days past 28 fall back to the month's last day in shorter months.
    static func monthlySlot(onOrAfter from: Date, day: Int, calendar cal: Calendar) -> Date {
        var monthStart = cal.date(from: cal.dateComponents([.year, .month], from: from))!
        for _ in 0..<3 {
            let length = cal.range(of: .day, in: .month, for: monthStart)!.count
            let slot = cal.date(byAdding: .day, value: min(day, length) - 1, to: monthStart)!
            if slot >= from { return slot }
            monthStart = cal.date(byAdding: .month, value: 1, to: monthStart)!
        }
        return from
    }

    /// Negative when overdue, 0 when due today.
    func daysUntilDue(from now: Date = .now, calendar cal: Calendar = .current) -> Int {
        cal.dateComponents([.day], from: cal.startOfDay(for: now), to: nextDue(calendar: cal)).day ?? 0
    }

    var scheduleDescription: String {
        Self.describe(kind: kind, intervalDays: intervalDays, weekdays: weekdays, dayOfMonth: dayOfMonth, startDate: startDate)
    }

    static func describe(kind: ScheduleKind, intervalDays: Int, weekdays: Set<Int> = [], dayOfMonth: Int = 1,
                         startDate: Date = .now) -> String {
        switch kind {
        case .interval:
            switch intervalDays {
            case 1: return "Every day"
            case 7: return "Every week"
            case let n where n % 7 == 0: return "Every \(n / 7) weeks"
            default: return "Every \(intervalDays) days"
            }
        case .weekly:
            let cal = Calendar.current
            let days = weekdays.isEmpty ? [cal.component(.weekday, from: startDate)] : weekdays
            if days.count == 7 { return "Every day" }
            let ordered = Weekdays.ordered(cal).filter(days.contains)
            return "Every " + ordered.map { cal.shortWeekdaySymbols[$0 - 1] }.joined(separator: ", ")
        case .monthly:
            let ordinal = NumberFormatter.localizedString(from: dayOfMonth as NSNumber, number: .ordinal)
            return "Monthly on the \(ordinal)" + (dayOfMonth > 28 ? " (or last day)" : "")
        }
    }

    // MARK: Stats

    /// Consecutive on-time completions, most recent first. Skips don't break a streak;
    /// being overdue right now does.
    var streak: Int {
        if !isPaused && daysUntilDue() < 0 { return 0 }
        var count = 0
        for completion in history where !completion.skipped {
            guard completion.isOnTime else { break }
            count += 1
        }
        return count
    }

    var onTimeRate: Double? {
        let done = (completions ?? []).filter { !$0.skipped }
        guard !done.isEmpty else { return nil }
        return Double(done.filter(\.isOnTime).count) / Double(done.count)
    }

    var timesDone: Int {
        (completions ?? []).filter { !$0.skipped }.count
    }
}

enum Weekdays {
    /// Weekday numbers (1 = Sunday) starting from the locale's first day of the week.
    static func ordered(_ cal: Calendar = .current) -> [Int] {
        (0..<7).map { (cal.firstWeekday - 1 + $0) % 7 + 1 }
    }
}
