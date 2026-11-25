package com.wsqm1990.fornow;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;
import android.util.Log;

/**
 * A Quick Settings tile: pull down the top bar, one tap, and the app opens straight into the
 * "It's hard right now" session. The tile only says "For Now", so nothing personal shows on
 * the lock screen. With the phone locked, Android asks for the unlock first.
 */
public class PicoTile extends TileService {
    @Override
    public void onStartListening() {
        Tile t = getQsTile();
        if (t == null) return;
        t.setLabel("For Now");
        t.setState(Tile.STATE_INACTIVE);
        t.updateTile();
    }

    @Override
    public void onClick() {
        if (isLocked()) {
            unlockAndRun(new Runnable() { @Override public void run() { abrir(); } });
        } else {
            abrir();
        }
    }

    @SuppressWarnings("deprecation")
    private void abrir() {
        Intent i = Rotulos.abrir(this, "pico");
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startActivityAndCollapse(PendingIntent.getActivity(this, 401, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            } else {
                startActivityAndCollapse(i);
            }
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "tile open", e);
        }
    }
}
