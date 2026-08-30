package com.playpixelpro.myperiod;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;

final class WidgetSnapshotStore {
    static final String REFRESH_ACTION = "com.playpixelpro.myperiod.WIDGET_REFRESH";
    private static final String PREFERENCES = "lunara.widget.v1";
    private static final String SNAPSHOT_KEY = "cycle-widget-snapshot-v1";

    private WidgetSnapshotStore() {}

    static void save(Context context, JSCompatibleSnapshot snapshot) {
        preferences(context).edit().putString(SNAPSHOT_KEY, snapshot.json).apply();
    }

    static void clear(Context context) {
        preferences(context).edit().remove(SNAPSHOT_KEY).apply();
    }

    static Snapshot read(Context context) {
        String json = preferences(context).getString(SNAPSHOT_KEY, null);
        if (json == null) return Snapshot.empty();
        try {
            JSONObject object = new JSONObject(json);
            String headline = object.optString("headline", "").trim();
            String detail = object.optString("detail", "").trim();
            if (headline.isEmpty()) return Snapshot.empty();
            return new Snapshot(headline, detail);
        } catch (Exception ignored) {
            return Snapshot.empty();
        }
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    static final class JSCompatibleSnapshot {
        final String json;

        JSCompatibleSnapshot(String json) {
            this.json = json;
        }
    }

    static final class Snapshot {
        final String headline;
        final String detail;

        Snapshot(String headline, String detail) {
            this.headline = headline;
            this.detail = detail;
        }

        static Snapshot empty() {
            return new Snapshot("Lunara", "Open to view your cycle");
        }
    }
}
