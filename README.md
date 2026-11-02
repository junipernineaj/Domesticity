# Domesticity

An iPhone app for household routines: changing sheets, watering plants, cleaning the fridge, hoovering, and so on. Give each routine a regularity; it comes up when it's due, reminds you, and tracks how reliably the household keeps up.

## Running it

1. Open `Domesticity.xcodeproj` in Xcode.
2. Under **Signing & Capabilities**, pick your Team (a free Apple ID works) and change the bundle identifier if Xcode complains.
3. Choose your iPhone (or a simulator) and press Run.

## How scheduling works

- **Every N days**: next due = last done + N days. Doing it late doesn't leave you with a backlog.
- **Weekly**: due on the chosen weekdays. Completing it early or late covers the current slot, and the next one is the following chosen day.
- **Monthly**: due on a day of the month. The 29th–31st fall back to the last day in shorter months.
- **Skip** moves a routine on without counting for or against your stats.

A completion is *on time* if it's done on or before its due day. The on-time rate also counts routines that are overdue right now, so ignoring a job can't flatter the score.

## Layout

- `Domesticity/Model`: SwiftData models, scheduling rules, reminders, stats, starter suggestions.
- `Domesticity/Views`: Today, Routines, Progress and Household tabs, plus the editor.

The schema is CloudKit-compatible (defaults everywhere, optional relationships) ready for household sharing over iCloud.
