package com.playpixelpro.myperiod;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(LunaraNativePlugin.class);
        registerPlugin(GeminiNanoPlugin.class);
        super.onCreate(savedInstanceState);
        WidgetRefreshJobService.schedule(this);
    }
}
