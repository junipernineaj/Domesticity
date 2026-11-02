import Charts
import SwiftData
import SwiftUI

struct StatsView: View {
    @Query private var chores: [Chore]
    @Query(sort: \Member.createdAt) private var members: [Member]

    @State private var window = 30

    var body: some View {
        NavigationStack {
            let stats = HouseholdStats(chores: chores, days: window)
            ScrollView {
                VStack(spacing: 16) {
                    Picker("Period", selection: $window) {
                        Text("Week").tag(7)
                        Text("Month").tag(30)
                        Text("Quarter").tag(90)
                    }
                    .pickerStyle(.segmented)

                    HStack(spacing: 12) {
                        StatTile(title: "On time", value: stats.onTimeRate.percentText, tint: rateColor(stats.onTimeRate))
                        StatTile(title: "Jobs done", value: "\(stats.done.count)")
                        StatTile(title: "Overdue now", value: "\(stats.overdueNow)",
                                 tint: stats.overdueNow > 0 ? .red : .primary)
                    }

                    Card(title: "Last 8 weeks") {
                        Chart(HouseholdStats.weekly(chores: chores, weeks: 8)) { point in
                            BarMark(x: .value("Week", point.weekStart, unit: .weekOfYear),
                                    y: .value("Jobs", point.count))
                                .foregroundStyle(by: .value("Status", point.status))
                        }
                        .chartForegroundStyleScale(["On time": Color.green, "Late": Color.orange])
                        .chartXAxis {
                            AxisMarks(values: .stride(by: .weekOfYear, count: 2)) {
                                AxisValueLabel(format: .dateTime.day().month(.abbreviated))
                            }
                        }
                        .frame(height: 180)
                    }

                    if !members.isEmpty {
                        Card(title: "Who's been doing what") {
                            ForEach(memberTallies(stats.done), id: \.name) { tally in
                                HStack {
                                    Text(tally.name).frame(width: 90, alignment: .leading).lineLimit(1)
                                    GeometryReader { geo in
                                        Capsule()
                                            .fill(tally.color.gradient)
                                            .frame(width: max(6, geo.size.width * tally.share))
                                    }
                                    .frame(height: 14)
                                    Text("\(tally.count)").monospacedDigit().foregroundStyle(.secondary)
                                }
                            }
                        }
                    }

                    let streaks = chores.filter { $0.streak > 1 }.sorted { $0.streak > $1.streak }.prefix(5)
                    if !streaks.isEmpty {
                        Card(title: "Best streaks") {
                            ForEach(Array(streaks)) { chore in
                                HStack {
                                    ChoreIcon(symbol: chore.symbol, room: chore.room, size: 28)
                                    Text(chore.title)
                                    Spacer()
                                    Label("\(chore.streak)", systemImage: "flame.fill")
                                        .foregroundStyle(.orange)
                                        .monospacedDigit()
                                }
                            }
                        }
                    }

                    let slipping = chores
                        .filter { !$0.isPaused && $0.timesDone >= 2 && ($0.onTimeRate ?? 1) < 0.7 }
                        .sorted { ($0.onTimeRate ?? 1) < ($1.onTimeRate ?? 1) }
                        .prefix(5)
                    if !slipping.isEmpty {
                        Card(title: "Often late") {
                            ForEach(Array(slipping)) { chore in
                                HStack {
                                    ChoreIcon(symbol: chore.symbol, room: chore.room, size: 28)
                                    VStack(alignment: .leading) {
                                        Text(chore.title)
                                        Text(chore.scheduleDescription).font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Text(chore.onTimeRate.percentText).foregroundStyle(.orange).monospacedDigit()
                                }
                            }
                            Text("If something is always late, try giving it a longer interval. A schedule you can keep is better than one you can't.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Progress")
            .overlay {
                if chores.isEmpty {
                    ContentUnavailableView("Nothing to track yet", systemImage: "chart.bar",
                                           description: Text("Tick off a few routines and your progress will show up here."))
                }
            }
        }
    }

    private struct Tally {
        let name: String
        let color: Color
        let count: Int
        let share: Double
    }

    private func memberTallies(_ done: [Completion]) -> [Tally] {
        let top = max(1, done.count)
        var tallies = members.map { member in
            let count = done.filter { $0.member?.uuid == member.uuid }.count
            return Tally(name: member.name, color: member.color, count: count, share: Double(count) / Double(top))
        }
        let unassigned = done.filter { $0.member == nil }.count
        if unassigned > 0 {
            tallies.append(Tally(name: "Unknown", color: .gray, count: unassigned, share: Double(unassigned) / Double(top)))
        }
        return tallies.sorted { $0.count > $1.count }
    }

    private func rateColor(_ rate: Double?) -> Color {
        guard let rate else { return .primary }
        return rate >= 0.8 ? .green : rate >= 0.5 ? .orange : .red
    }
}
