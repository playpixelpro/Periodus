import SwiftUI
import WidgetKit

private let widgetSuite = "group.com.playpixelpro.myperiod"
private let widgetSnapshotKey = "cycle-widget-snapshot-v1"

private struct CycleSnapshot: Decodable {
    let headline: String
    let detail: String?

    static let empty = CycleSnapshot(
        headline: "Open Periodus",
        detail: "Log today to see your cycle at a glance."
    )

    static func current() -> CycleSnapshot {
        guard
            let json = UserDefaults(suiteName: widgetSuite)?.string(forKey: widgetSnapshotKey),
            let data = json.data(using: .utf8),
            let decoded = try? JSONDecoder().decode(CycleSnapshot.self, from: data),
            !decoded.headline.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            return .empty
        }
        return decoded
    }
}

private struct CycleEntry: TimelineEntry {
    let date: Date
    let snapshot: CycleSnapshot
}

private struct CycleProvider: TimelineProvider {
    func placeholder(in context: Context) -> CycleEntry {
        CycleEntry(
            date: Date(),
            snapshot: CycleSnapshot(
                headline: "Cycle day 12",
                detail: "Your fertile window is approaching."
            )
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (CycleEntry) -> Void) {
        completion(CycleEntry(date: Date(), snapshot: CycleSnapshot.current()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CycleEntry>) -> Void) {
        let entry = CycleEntry(date: Date(), snapshot: CycleSnapshot.current())
        let nextRefresh = Calendar.current.date(byAdding: .hour, value: 6, to: Date())
            ?? Date(timeIntervalSinceNow: 6 * 60 * 60)
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }
}

private struct LunaraCycleWidgetView: View {
    let entry: CycleEntry

    @ViewBuilder
    var body: some View {
        if #available(iOSApplicationExtension 17.0, *) {
            content.containerBackground(gradient, for: .widget)
        } else {
            content.background(gradient)
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "moon.fill")
                    .font(.caption)
                Text("PERIODUS")
                    .font(.caption2.weight(.bold))
                    .tracking(1.1)
            }
            .foregroundStyle(Color(red: 0.47, green: 0.18, blue: 0.35))

            Spacer(minLength: 0)

            Text(entry.snapshot.headline)
                .font(.headline.weight(.semibold))
                .foregroundStyle(Color(red: 0.20, green: 0.10, blue: 0.17))
                .lineLimit(2)

            if let detail = entry.snapshot.detail, !detail.isEmpty {
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(Color(red: 0.36, green: 0.25, blue: 0.32))
                    .lineLimit(3)
            }
        }
        .padding()
    }

    private var gradient: LinearGradient {
        LinearGradient(
            colors: [
                Color(red: 1.00, green: 0.94, blue: 0.97),
                Color(red: 0.96, green: 0.88, blue: 0.94)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

private struct LunaraCycleWidget: Widget {
    let kind = "LunaraCycleWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CycleProvider()) { entry in
            LunaraCycleWidgetView(entry: entry)
        }
        .configurationDisplayName("Cycle at a glance")
        .description("See the latest private summary published by Periodus.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct LunaraWidgetBundle: WidgetBundle {
    var body: some Widget {
        LunaraCycleWidget()
    }
}
