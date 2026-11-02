import Foundation

/// Success over a recent window. Routines that are overdue right now count against
/// the on-time rate, so ignoring a job can't flatter the score.
struct HouseholdStats {
    let done: [Completion]
    let overdueNow: Int

    init(chores: [Chore], days: Int, now: Date = .now) {
        let cal = Calendar.current
        let since = cal.date(byAdding: .day, value: -days, to: cal.startOfDay(for: now))!
        done = chores
            .flatMap { $0.completions ?? [] }
            .filter { !$0.skipped && $0.date >= since }
        overdueNow = chores.filter { !$0.isPaused && $0.daysUntilDue(from: now) < 0 }.count
    }

    var onTimeCount: Int { done.filter(\.isOnTime).count }
    var lateCount: Int { done.count - onTimeCount }

    var onTimeRate: Double? {
        let total = done.count + overdueNow
        return total == 0 ? nil : Double(onTimeCount) / Double(total)
    }

    struct WeekPoint: Identifiable {
        var id: String { "\(weekStart.timeIntervalSince1970)-\(status)" }
        let weekStart: Date
        let status: String
        let count: Int
    }

    static func weekly(chores: [Chore], weeks: Int, now: Date = .now) -> [WeekPoint] {
        let cal = Calendar.current
        let thisWeek = cal.dateInterval(of: .weekOfYear, for: now)!.start
        let all = chores.flatMap { $0.completions ?? [] }.filter { !$0.skipped }
        return (0..<weeks).reversed().flatMap { offset -> [WeekPoint] in
            let start = cal.date(byAdding: .weekOfYear, value: -offset, to: thisWeek)!
            let end = cal.date(byAdding: .weekOfYear, value: 1, to: start)!
            let inWeek = all.filter { $0.date >= start && $0.date < end }
            let onTime = inWeek.filter(\.isOnTime).count
            return [
                WeekPoint(weekStart: start, status: "On time", count: onTime),
                WeekPoint(weekStart: start, status: "Late", count: inWeek.count - onTime),
            ]
        }
    }
}
