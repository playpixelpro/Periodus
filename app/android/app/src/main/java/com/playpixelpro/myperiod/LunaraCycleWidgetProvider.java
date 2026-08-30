package com.playpixelpro.myperiod;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public final class LunaraCycleWidgetProvider extends AppWidgetProvider {
    @Override
    public void onEnabled(Context context) {
        WidgetRefreshJobService.schedule(context);
    }

    @Override
    public void onDisabled(Context context) {
        WidgetRefreshJobService.cancel(context);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        render(context, manager, appWidgetIds);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (WidgetSnapshotStore.REFRESH_ACTION.equals(intent.getAction())) updateAll(context);
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(
            new ComponentName(context, LunaraCycleWidgetProvider.class)
        );
        render(context, manager, ids);
    }

    private static void render(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        if (appWidgetIds == null || appWidgetIds.length == 0) return;
        WidgetSnapshotStore.Snapshot snapshot = WidgetSnapshotStore.read(context);
        for (int id : appWidgetIds) {
            RemoteViews views = new RemoteViews(
                context.getPackageName(),
                R.layout.lunara_cycle_widget
            );
            views.setTextViewText(R.id.widget_headline, snapshot.headline);
            views.setTextViewText(R.id.widget_detail, snapshot.detail);

            Intent launch = new Intent(context, MainActivity.class);
            launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pending = PendingIntent.getActivity(
                context,
                0,
                launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_container, pending);
            manager.updateAppWidget(id, views);
        }
    }
}
