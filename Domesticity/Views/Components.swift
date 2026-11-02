import SwiftUI

enum MemberColor: String, CaseIterable, Identifiable {
    case blue, green, orange, pink, purple, teal, red, indigo
    var id: String { rawValue }

    var color: Color {
        switch self {
        case .blue: .blue
        case .green: .green
        case .orange: .orange
        case .pink: .pink
        case .purple: .purple
        case .teal: .teal
        case .red: .red
        case .indigo: .indigo
        }
    }
}

extension Member {
    var color: Color { (MemberColor(rawValue: colorName) ?? .blue).color }
    var initial: String { name.first.map { String($0).uppercased() } ?? "?" }
}

enum Due {
    static func label(daysUntil days: Int, date: Date) -> String {
        switch days {
        case ..<(-1): "\(-days) days overdue"
        case -1: "1 day overdue"
        case 0: "Due today"
        case 1: "Tomorrow"
        case 2...6: date.formatted(.dateTime.weekday(.wide))
        default: date.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated))
        }
    }

    static func color(daysUntil days: Int) -> Color {
        switch days {
        case ..<0: .red
        case 0: .orange
        default: .secondary
        }
    }
}

/// A stable tint per room, so the same room always gets the same colour.
func roomTint(_ room: String) -> Color {
    switch room {
    case "Kitchen": return .orange
    case "Bedroom": return .indigo
    case "Bathroom": return .cyan
    case "Living room": return .brown
    case "Whole house": return .purple
    case "Plants & garden": return .green
    case "Laundry": return .blue
    default: break
    }
    let palette: [Color] = [.teal, .pink, .mint, .red, .yellow]
    let hash = room.unicodeScalars.reduce(0) { ($0 &* 31 &+ Int($1.value)) & 0xFFFF }
    return palette[hash % palette.count]
}

struct ChoreIcon: View {
    let symbol: String
    let room: String
    var size: CGFloat = 38

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.45, weight: .semibold))
            .foregroundStyle(roomTint(room))
            .frame(width: size, height: size)
            .background(roomTint(room).opacity(0.15), in: .rect(cornerRadius: size * 0.26))
    }
}

struct MemberBadge: View {
    let member: Member
    var size: CGFloat = 24

    var body: some View {
        Text(member.initial)
            .font(.system(size: size * 0.5, weight: .bold, design: .rounded))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(member.color, in: .circle)
            .accessibilityLabel(member.name)
    }
}

struct ChoreRow: View {
    let chore: Chore
    var now: Date = .now
    var showsCheck = true
    var onDone: () -> Void = {}

    @State private var ticked = false

    var body: some View {
        let days = chore.daysUntilDue(from: now)
        HStack(spacing: 12) {
            ChoreIcon(symbol: chore.symbol, room: chore.room)
            VStack(alignment: .leading, spacing: 2) {
                Text(chore.title)
                    .font(.body.weight(.medium))
                    .strikethrough(ticked)
                Group {
                    if chore.isPaused {
                        Text("Paused · \(chore.room)")
                    } else {
                        Text(Due.label(daysUntil: days, date: chore.nextDue()))
                            .foregroundStyle(Due.color(daysUntil: days))
                        + Text(" · \(chore.scheduleDescription.lowercasedFirst)")
                            .foregroundStyle(.secondary)
                    }
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
            Spacer(minLength: 8)
            if let assignee = chore.assignee {
                MemberBadge(member: assignee)
            }
            if showsCheck {
                Button(action: tick) {
                    Image(systemName: ticked ? "checkmark.circle.fill" : "circle")
                        .font(.title2)
                        .foregroundStyle(ticked ? Color.green : Color.secondary)
                        .contentTransition(.symbolEffect(.replace))
                }
                .buttonStyle(.borderless)
                .sensoryFeedback(.success, trigger: ticked) { _, new in new }
                .accessibilityLabel("Mark \(chore.title) done")
            }
        }
        .padding(.vertical, 2)
    }

    private func tick() {
        withAnimation(.snappy) { ticked = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) {
            withAnimation { onDone() }
            ticked = false
        }
    }
}

struct StatTile: View {
    let title: String
    let value: String
    var tint: Color = .primary

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(.title2.weight(.bold).monospacedDigit())
                .foregroundStyle(tint)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 12))
    }
}

struct Card<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.headline)
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 16))
    }
}

extension String {
    var lowercasedFirst: String { prefix(1).lowercased() + dropFirst() }
}

extension Optional where Wrapped == Double {
    var percentText: String { map { "\(Int(($0 * 100).rounded()))%" } ?? "–" }
}
