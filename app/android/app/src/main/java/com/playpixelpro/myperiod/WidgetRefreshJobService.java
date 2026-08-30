package com.playpixelpro.myperiod;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;

/**
 * Refreshes the rendered widget from the last redacted snapshot. It does not
 * open the WebView or recompute predictions from the private cycle database.
 */
public final class WidgetRefreshJobService extends JobService {
    private static final int JOB_ID = 0x4C554E41;
    private static final long REFRESH_INTERVAL_MILLIS = 12L * 60L * 60L * 1000L;

    static void schedule(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return;
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (scheduler == null || scheduler.getPendingJob(JOB_ID) != null) return;
        JobInfo job = new JobInfo.Builder(
            JOB_ID,
            new ComponentName(context, WidgetRefreshJobService.class)
        )
            .setPeriodic(REFRESH_INTERVAL_MILLIS)
            .setPersisted(true)
            .build();
        scheduler.schedule(job);
    }

    static void cancel(Context context) {
        JobScheduler scheduler = (JobScheduler) context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (scheduler != null) scheduler.cancel(JOB_ID);
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        LunaraCycleWidgetProvider.updateAll(this);
        jobFinished(params, false);
        return false;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return false;
    }
}
