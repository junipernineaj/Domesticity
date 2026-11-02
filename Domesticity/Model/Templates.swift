import Foundation

struct ChoreTemplate: Identifiable, Hashable {
    var id: String { title }
    let title: String
    let symbol: String
    let room: String
    var kind: ScheduleKind = .interval
    var intervalDays: Int = 7
    var dayOfMonth: Int = 1

    static let all: [ChoreTemplate] = [
        .init(title: "Change the bed sheets", symbol: "bed.double", room: "Bedroom", intervalDays: 7),
        .init(title: "Wash pillows & duvet", symbol: "bed.double", room: "Bedroom", intervalDays: 90),
        .init(title: "Rotate the mattress", symbol: "arrow.triangle.2.circlepath", room: "Bedroom", intervalDays: 90),

        .init(title: "Clean out the fridge", symbol: "refrigerator", room: "Kitchen", intervalDays: 30),
        .init(title: "Clean the oven", symbol: "oven", room: "Kitchen", intervalDays: 60),
        .init(title: "Clean the microwave", symbol: "microwave", room: "Kitchen", intervalDays: 14),
        .init(title: "Wipe down the hob", symbol: "stove", room: "Kitchen", intervalDays: 3),
        .init(title: "Descale the kettle", symbol: "cup.and.saucer", room: "Kitchen", intervalDays: 30),
        .init(title: "Defrost the freezer", symbol: "snowflake", room: "Kitchen", intervalDays: 180),
        .init(title: "Clean the dishwasher filter", symbol: "sink", room: "Kitchen", intervalDays: 30),
        .init(title: "Take the bins out", symbol: "trash", room: "Kitchen", intervalDays: 7),

        .init(title: "Clean the bathroom", symbol: "shower", room: "Bathroom", intervalDays: 7),
        .init(title: "Clean the toilet", symbol: "toilet", room: "Bathroom", intervalDays: 7),
        .init(title: "Wash the towels", symbol: "washer", room: "Bathroom", intervalDays: 7),
        .init(title: "Descale the shower head", symbol: "shower", room: "Bathroom", intervalDays: 60),

        .init(title: "Hoover", symbol: "wind", room: "Whole house", intervalDays: 7),
        .init(title: "Mop the floors", symbol: "bubbles.and.sparkles", room: "Whole house", intervalDays: 14),
        .init(title: "Dust surfaces", symbol: "sparkles", room: "Whole house", intervalDays: 14),
        .init(title: "Clean the windows", symbol: "window.vertical.closed", room: "Whole house", intervalDays: 60),
        .init(title: "Test the smoke alarms", symbol: "flame", room: "Whole house", kind: .monthly, dayOfMonth: 1),

        .init(title: "Water the plants", symbol: "drop", room: "Plants & garden", intervalDays: 3),
        .init(title: "Feed the plants", symbol: "leaf", room: "Plants & garden", intervalDays: 30),
        .init(title: "Mow the lawn", symbol: "tree", room: "Plants & garden", intervalDays: 14),

        .init(title: "Clean the washing machine", symbol: "washer", room: "Laundry", intervalDays: 30),
        .init(title: "Empty the tumble dryer lint", symbol: "dryer", room: "Laundry", intervalDays: 3),
    ]

    static let rooms = ["Kitchen", "Bedroom", "Bathroom", "Living room", "Whole house", "Plants & garden", "Laundry"]

    static let symbols = [
        "sparkles", "bubbles.and.sparkles", "wind", "trash", "arrow.3.trianglepath",
        "bed.double", "sofa", "chair.lounge", "lamp.desk", "lightbulb", "window.vertical.closed", "door.left.hand.closed",
        "refrigerator", "oven", "stove", "microwave", "sink", "cup.and.saucer", "fork.knife", "snowflake", "carrot",
        "shower", "toilet", "bathtub", "washer", "dryer", "tshirt", "basket",
        "drop", "leaf", "tree", "camera.macro", "pawprint", "cat", "dog",
        "car", "flame", "humidifier", "air.purifier", "battery.100", "pills", "cart", "scissors", "house",
    ]
}
