import SwiftData
import SwiftUI

struct ChoresView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Chore.title) private var chores: [Chore]

    @State private var search = ""
    @State private var showingNew = false
    @State private var showingTemplates = false

    var body: some View {
        NavigationStack {
            let matching = chores.filter { search.isEmpty || $0.title.localizedCaseInsensitiveContains(search) }
            let rooms = Dictionary(grouping: matching, by: \.room)

            List {
                ForEach(rooms.keys.sorted(), id: \.self) { room in
                    Section(room) {
                        ForEach(rooms[room]!.sorted { $0.daysUntilDue() < $1.daysUntilDue() }) { chore in
                            NavigationLink(value: chore) {
                                ChoreRow(chore: chore, showsCheck: false)
                            }
                            .swipeActions {
                                Button("Delete", systemImage: "trash", role: .destructive) {
                                    context.delete(chore)
                                    Store.save(context)
                                }
                            }
                        }
                    }
                }
            }
            .overlay {
                if chores.isEmpty {
                    ContentUnavailableView {
                        Label("No routines yet", systemImage: "square.grid.2x2")
                    } actions: {
                        Button("Pick from suggestions") { showingTemplates = true }
                            .buttonStyle(.borderedProminent)
                        Button("Add my own") { showingNew = true }
                    }
                } else if matching.isEmpty {
                    ContentUnavailableView.search(text: search)
                }
            }
            .searchable(text: $search, prompt: "Find a routine")
            .navigationTitle("Routines")
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
        }
    }
}

struct ChoreDetailView: View {
    let chore: Chore

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var showingEditor = false
    @State private var confirmingDelete = false

    var body: some View {
        let days = chore.daysUntilDue()
        List {
            Section {
                VStack(spacing: 12) {
                    ChoreIcon(symbol: chore.symbol, room: chore.room, size: 64)
                    Text(chore.title)
                        .font(.title2.weight(.bold))
                        .multilineTextAlignment(.center)
                    Text("\(chore.scheduleDescription) · \(chore.room)")
                        .foregroundStyle(.secondary)
                    if chore.isPaused {
                        Label("Paused", systemImage: "pause.circle")
                            .foregroundStyle(.secondary)
                    } else {
                        Text(Due.label(daysUntil: days, date: chore.nextDue()))
                            .font(.headline)
                            .foregroundStyle(days <= 0 ? Due.color(daysUntil: days) : .primary)
                    }
                    HStack {
                        Button {
                            Store.complete(chore, by: Store.currentMember(in: context), in: context)
                        } label: {
                            Label("Done", systemImage: "checkmark").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        Button {
                            Store.complete(chore, by: nil, skipped: true, in: context)
                        } label: {
                            Label("Skip", systemImage: "forward").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    }
                    .controlSize(.large)
                    .sensoryFeedback(.success, trigger: chore.completions?.count ?? 0)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            }

            Section("Track record") {
                LabeledContent("Current streak", value: "\(chore.streak)")
                LabeledContent("Done on time", value: chore.onTimeRate.percentText)
                LabeledContent("Times done", value: "\(chore.timesDone)")
                LabeledContent("Last done") {
                    Text(chore.lastDone.map { $0.date.formatted(.relative(presentation: .named)) } ?? "Never")
                }
                if let assignee = chore.assignee {
                    LabeledContent("Usually done by", value: assignee.name)
                }
            }

            if !chore.notes.isEmpty {
                Section("Notes") { Text(chore.notes) }
            }

            Section {
                if chore.history.isEmpty {
                    Text("Nothing logged yet.").foregroundStyle(.secondary)
                }
                ForEach(chore.history) { entry in
                    HistoryRow(entry: entry)
                }
                .onDelete { offsets in
                    let history = chore.history
                    for index in offsets { context.delete(history[index]) }
                    Store.save(context)
                }
            } header: {
                Text("History")
            } footer: {
                if !chore.history.isEmpty { Text("Swipe an entry to remove it if you logged it by mistake.") }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button("Edit", systemImage: "pencil") { showingEditor = true }
                    Button("Delete routine", systemImage: "trash", role: .destructive) { confirmingDelete = true }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showingEditor) { ChoreEditor(chore: chore) }
        .confirmationDialog("Delete “\(chore.title)” and its history?", isPresented: $confirmingDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                dismiss()
                // Delete once the view has gone so it never renders a deleted model.
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    context.delete(chore)
                    Store.save(context)
                }
            }
        }
    }
}

private struct HistoryRow: View {
    let entry: Completion

    var body: some View {
        HStack {
            Image(systemName: entry.skipped ? "forward.circle" : entry.isOnTime ? "checkmark.circle.fill" : "clock.badge.exclamationmark")
                .foregroundStyle(entry.skipped ? Color.secondary : entry.isOnTime ? Color.green : Color.orange)
            VStack(alignment: .leading) {
                Text(entry.date.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated).year()))
                Text(caption).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            if let member = entry.member {
                MemberBadge(member: member, size: 22)
            }
        }
    }

    private var caption: String {
        if entry.skipped { return "Skipped" }
        let cal = Calendar.current
        let late = cal.dateComponents([.day], from: entry.dueDate, to: cal.startOfDay(for: entry.date)).day ?? 0
        let who = entry.member.map { " · \($0.name)" } ?? ""
        return (late > 0 ? "\(late) day\(late == 1 ? "" : "s") late" : "On time") + who
    }
}
