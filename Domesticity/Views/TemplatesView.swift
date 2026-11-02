import SwiftData
import SwiftUI

struct TemplatesView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query private var chores: [Chore]

    @State private var selected: Set<ChoreTemplate> = []

    var body: some View {
        NavigationStack {
            let existing = Set(chores.map { $0.title.lowercased() })
            let available = ChoreTemplate.all.filter { !existing.contains($0.title.lowercased()) }
            let rooms = Dictionary(grouping: available, by: \.room)

            List {
                ForEach(ChoreTemplate.rooms.filter { rooms[$0] != nil }, id: \.self) { room in
                    Section(room) {
                        ForEach(rooms[room]!) { template in
                            Button {
                                if selected.contains(template) { selected.remove(template) } else { selected.insert(template) }
                            } label: {
                                HStack(spacing: 12) {
                                    ChoreIcon(symbol: template.symbol, room: template.room, size: 32)
                                    VStack(alignment: .leading) {
                                        Text(template.title).foregroundStyle(.primary)
                                        Text(describe(template)).font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Image(systemName: selected.contains(template) ? "checkmark.circle.fill" : "circle")
                                        .font(.title3)
                                        .foregroundStyle(selected.contains(template) ? Color.accentColor : Color.secondary)
                                }
                            }
                        }
                    }
                }
            }
            .overlay {
                if available.isEmpty {
                    ContentUnavailableView("You've added them all", systemImage: "checkmark.seal")
                }
            }
            .safeAreaInset(edge: .bottom) {
                if !selected.isEmpty {
                    Text("First due dates are spread over the next week, so it doesn't all land at once. You can change any of them afterwards.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(.bar)
                }
            }
            .navigationTitle("Suggestions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(selected.isEmpty ? "Add" : "Add \(selected.count)", action: add)
                        .disabled(selected.isEmpty)
                }
            }
        }
    }

    private func describe(_ template: ChoreTemplate) -> String {
        Chore.describe(kind: template.kind, intervalDays: template.intervalDays, dayOfMonth: template.dayOfMonth)
    }

    private func add() {
        let cal = Calendar.current
        let today = cal.startOfDay(for: .now)
        let ordered = ChoreTemplate.all.filter(selected.contains)
        for (index, template) in ordered.enumerated() {
            let chore = Chore(title: template.title, symbol: template.symbol, room: template.room)
            chore.kind = template.kind
            chore.intervalDays = template.intervalDays
            chore.dayOfMonth = template.dayOfMonth
            let spread = min(template.intervalDays, 7)
            chore.startDate = cal.date(byAdding: .day, value: index % spread, to: today)!
            context.insert(chore)
        }
        Store.save(context)
        dismiss()
    }
}
