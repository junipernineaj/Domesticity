import SwiftData
import SwiftUI

private struct ChoreDraft {
    var title = ""
    var symbol = "sparkles"
    var room = "Kitchen"
    var notes = ""
    var kind = ScheduleKind.interval
    var intervalDays = 7
    var weekdays: Set<Int> = [Calendar.current.component(.weekday, from: .now)]
    var dayOfMonth = Calendar.current.component(.day, from: .now)
    var startDate = Date.now
    var remindersOn = true
    var reminderTime = Calendar.current.date(bySettingHour: 9, minute: 0, second: 0, of: .now)!
    var assignee: Member?
    var isPaused = false

    init() {}

    init(chore: Chore) {
        title = chore.title
        symbol = chore.symbol
        room = chore.room
        notes = chore.notes
        kind = chore.kind
        intervalDays = chore.intervalDays
        if !chore.weekdays.isEmpty { weekdays = chore.weekdays }
        dayOfMonth = chore.dayOfMonth
        startDate = chore.startDate
        remindersOn = chore.remindersOn
        reminderTime = Calendar.current.date(bySettingHour: chore.reminderHour, minute: chore.reminderMinute, second: 0, of: .now)!
        assignee = chore.assignee
        isPaused = chore.isPaused
    }

    func apply(to chore: Chore) {
        let cal = Calendar.current
        chore.title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        chore.symbol = symbol
        chore.room = room.trimmingCharacters(in: .whitespaces).isEmpty ? "General" : room
        chore.notes = notes
        chore.kind = kind
        chore.intervalDays = intervalDays
        chore.weekdays = weekdays
        chore.dayOfMonth = dayOfMonth
        chore.startDate = cal.startOfDay(for: startDate)
        chore.remindersOn = remindersOn
        chore.reminderHour = cal.component(.hour, from: reminderTime)
        chore.reminderMinute = cal.component(.minute, from: reminderTime)
        chore.assignee = assignee
        chore.isPaused = isPaused
    }
}

struct ChoreEditor: View {
    var chore: Chore?

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \Member.createdAt) private var members: [Member]
    @Query private var allChores: [Chore]

    @State private var draft: ChoreDraft

    init(chore: Chore? = nil) {
        self.chore = chore
        _draft = State(initialValue: chore.map(ChoreDraft.init(chore:)) ?? ChoreDraft())
    }

    private var rooms: [String] {
        Array(Set(ChoreTemplate.rooms + allChores.map(\.room))).sorted()
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("What needs doing?", text: $draft.title)
                        .font(.headline)
                    NavigationLink {
                        SymbolPicker(selection: $draft.symbol, room: draft.room)
                    } label: {
                        LabeledContent("Icon") {
                            ChoreIcon(symbol: draft.symbol, room: draft.room, size: 30)
                        }
                    }
                    HStack {
                        Text("Room")
                        TextField("Room", text: $draft.room)
                            .multilineTextAlignment(.trailing)
                            .foregroundStyle(.secondary)
                        Menu {
                            ForEach(rooms, id: \.self) { room in
                                Button(room) { draft.room = room }
                            }
                        } label: {
                            Image(systemName: "chevron.up.chevron.down")
                        }
                    }
                }

                Section {
                    Picker("Repeats", selection: $draft.kind) {
                        ForEach(ScheduleKind.allCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowSeparator(.hidden)

                    switch draft.kind {
                    case .interval:
                        Stepper(value: $draft.intervalDays, in: 1...365) {
                            Text(draft.intervalDays == 1 ? "Every day" : "Every \(draft.intervalDays) days")
                        }
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack {
                                ForEach([1, 3, 7, 14, 30, 90, 180], id: \.self) { days in
                                    Button(Self.presetLabel(days)) { draft.intervalDays = days }
                                        .buttonStyle(.bordered)
                                        .tint(draft.intervalDays == days ? .accentColor : .secondary)
                                        .controlSize(.small)
                                }
                            }
                        }
                        DatePicker("First due", selection: $draft.startDate, displayedComponents: .date)
                    case .weekly:
                        WeekdayPicker(selection: $draft.weekdays)
                        DatePicker("Starting", selection: $draft.startDate, displayedComponents: .date)
                    case .monthly:
                        Stepper(value: $draft.dayOfMonth, in: 1...31) {
                            Text("On the \(NumberFormatter.localizedString(from: draft.dayOfMonth as NSNumber, number: .ordinal))")
                        }
                        DatePicker("Starting", selection: $draft.startDate, displayedComponents: .date)
                    }
                } header: {
                    Text("Schedule")
                } footer: {
                    Text(draft.kind == .interval
                         ? "Counts from the day you last did it, so doing it late doesn't leave you with a backlog."
                         : "Stays fixed on the calendar whenever you actually do it.")
                }

                Section("Reminder") {
                    Toggle("Remind me", isOn: $draft.remindersOn)
                    if draft.remindersOn {
                        DatePicker("At", selection: $draft.reminderTime, displayedComponents: .hourAndMinute)
                    }
                }

                Section {
                    Picker("Usually done by", selection: $draft.assignee) {
                        Text("Anyone").tag(Member?.none)
                        ForEach(members) { Text($0.name).tag(Optional($0)) }
                    }
                } header: {
                    Text("Household")
                } footer: {
                    if members.isEmpty { Text("Add people on the Household tab to share out the jobs.") }
                }

                Section("Notes") {
                    TextField("Products, tips, where things live…", text: $draft.notes, axis: .vertical)
                        .lineLimit(2...6)
                }

                if chore != nil {
                    Section {
                        Toggle("Paused", isOn: $draft.isPaused)
                    } footer: {
                        Text("Paused routines don't come up or send reminders, which is handy for holidays or seasonal jobs.")
                    }
                }
            }
            .navigationTitle(chore == nil ? "New routine" : "Edit routine")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", action: save)
                        .disabled(draft.title.trimmingCharacters(in: .whitespaces).isEmpty
                                  || (draft.kind == .weekly && draft.weekdays.isEmpty))
                }
            }
        }
    }

    private func save() {
        let target = chore ?? {
            let new = Chore(title: draft.title)
            context.insert(new)
            return new
        }()
        draft.apply(to: target)
        Store.save(context)
        dismiss()
    }

    private static func presetLabel(_ days: Int) -> String {
        switch days {
        case 1: "Daily"
        case 7: "Weekly"
        case 14: "Fortnightly"
        case 30: "Monthly"
        case 90: "3 months"
        case 180: "6 months"
        default: "\(days) days"
        }
    }
}

struct WeekdayPicker: View {
    @Binding var selection: Set<Int>

    var body: some View {
        let cal = Calendar.current
        HStack {
            ForEach(Weekdays.ordered(cal), id: \.self) { day in
                let on = selection.contains(day)
                Button {
                    if on { selection.remove(day) } else { selection.insert(day) }
                } label: {
                    Text(cal.veryShortWeekdaySymbols[day - 1])
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 36)
                        .foregroundStyle(on ? Color.white : Color.primary)
                        .background(on ? Color.accentColor : Color(.tertiarySystemFill), in: .circle)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(cal.weekdaySymbols[day - 1])
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
    }
}

private struct SymbolPicker: View {
    @Binding var selection: String
    let room: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 56))], spacing: 12) {
                ForEach(ChoreTemplate.symbols, id: \.self) { symbol in
                    Button {
                        selection = symbol
                        dismiss()
                    } label: {
                        ChoreIcon(symbol: symbol, room: room, size: 52)
                            .overlay {
                                if symbol == selection {
                                    RoundedRectangle(cornerRadius: 14).stroke(Color.accentColor, lineWidth: 3)
                                }
                            }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding()
        }
        .navigationTitle("Icon")
    }
}
