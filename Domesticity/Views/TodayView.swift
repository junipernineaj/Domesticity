import SwiftData
import SwiftUI

struct TodayView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.scenePhase) private var scenePhase
    @Query(sort: \Chore.title) private var chores: [Chore]
    @Query(sort: \Member.createdAt) private var members: [Member]

    @State private var now = Date.now
    @State private var showingNew = false
    @State private var showingTemplates = false

    var body: some View {
        NavigationStack {
            let scheduled = chores
                .filter { !$0.isPaused }
                .map { (chore: $0, days: $0.daysUntilDue(from: now)) }
                .sorted { $0.days < $1.days }
            let overdue = scheduled.filter { $0.days < 0 }.map(\.chore)
            let today = scheduled.filter { $0.days == 0 }.map(\.chore)
            let soon = scheduled.filter { (1...7).contains($0.days) }.map(\.chore)

            List {
                if !chores.isEmpty {
                    Section {
                        summary(overdue: overdue.count, today: today.count)
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
                section("Overdue", overdue)
                section("Today", today)
                section("Next 7 days", soon)

                if !chores.isEmpty && overdue.isEmpty && today.isEmpty {
                    Section {
                        Label("All caught up for today", systemImage: "checkmark.seal")
                            .foregroundStyle(.green)
                    }
                }
            }
            .overlay {
                if chores.isEmpty {
                    ContentUnavailableView {
                        Label("No routines yet", systemImage: "house")
                    } description: {
                        Text("Add the jobs that keep your home running, like sheets, plants, the fridge and the hoovering, and Domesticity will bring them up when they're due.")
                    } actions: {
                        Button("Pick from suggestions") { showingTemplates = true }
                            .buttonStyle(.borderedProminent)
                        Button("Add my own") { showingNew = true }
                    }
                }
            }
            .navigationTitle("Today")
            .navigationDestination(for: Chore.self) { ChoreDetailView(chore: $0) }
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button("New routine", systemImage: "plus") { showingNew = true }
                        Button("From suggestions", systemImage: "list.bullet") { showingTemplates = true }
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingNew) { ChoreEditor() }
            .sheet(isPresented: $showingTemplates) { TemplatesView() }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active { now = .now }
            }
        }
    }

    @ViewBuilder
    private func section(_ title: String, _ items: [Chore]) -> some View {
        if !items.isEmpty {
            Section(title) {
                ForEach(items) { chore in
                    NavigationLink(value: chore) {
                        ChoreRow(chore: chore, now: now) { complete(chore) }
                    }
                    .swipeActions(edge: .leading) {
                        Button("Done", systemImage: "checkmark") { complete(chore) }
                            .tint(.green)
                    }
                    .swipeActions(edge: .trailing) {
                        Button("Skip", systemImage: "forward") {
                            Store.complete(chore, by: nil, skipped: true, in: context)
                        }
                        .tint(.gray)
                    }
                    .contextMenu {
                        if !members.isEmpty {
                            Section("Done by…") {
                                ForEach(members) { member in
                                    Button(member.name) { Store.complete(chore, by: member, in: context) }
                                }
                            }
                        }
                        Button("Skip this time", systemImage: "forward") {
                            Store.complete(chore, by: nil, skipped: true, in: context)
                        }
                    }
                }
            }
        }
    }

    private func summary(overdue: Int, today: Int) -> some View {
        let stats = HouseholdStats(chores: chores, days: 30, now: now)
        return HStack(spacing: 16) {
            Gauge(value: stats.onTimeRate ?? 0) {
                EmptyView()
            } currentValueLabel: {
                Text(stats.onTimeRate.percentText)
                    .font(.caption.weight(.bold))
            }
            .gaugeStyle(.accessoryCircularCapacity)
            .tint(.green)

            VStack(alignment: .leading, spacing: 4) {
                Text(headline(overdue: overdue, today: today))
                    .font(.headline)
                Text("\(stats.onTimeRate.percentText) done on time in the last 30 days")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 16))
    }

    private func headline(overdue: Int, today: Int) -> String {
        switch (overdue, today) {
        case (0, 0): "Nothing due today"
        case (0, _): "\(today) due today"
        case (_, 0): "\(overdue) overdue"
        default: "\(today) due today · \(overdue) overdue"
        }
    }

    private func complete(_ chore: Chore) {
        Store.complete(chore, by: Store.currentMember(in: context), in: context)
    }
}
