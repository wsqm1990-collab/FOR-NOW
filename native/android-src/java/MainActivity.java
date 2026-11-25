package com.wsqm1990.fornow;

import android.content.Intent;
import android.os.Bundle;

import androidx.activity.EdgeToEdge;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // what opened the app (widget, quick settings tile, shortcut, alarm) is kept until the page asks
        ForNowPlugin.lembrarAcao(getIntent());
        registerPlugin(ForNowPlugin.class);
        super.onCreate(savedInstanceState);
        try {
            EdgeToEdge.enable(this);
        } catch (Exception ignored) { }
        ForNowPlugin.applySavedBundle(this, getBridge());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        ForNowPlugin.lembrarAcao(intent);
        ForNowPlugin.avisarAcao();
    }
}
