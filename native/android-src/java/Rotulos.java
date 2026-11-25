package com.wsqm1990.fornow;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.os.Build;
import android.service.quicksettings.TileService;
import android.util.Log;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * Texts the phone shows outside the page (widget, shortcuts, alarm screen), in the language
 * chosen in the app, plus the intents that open the app straight into a moment.
 */
final class Rotulos {
    static final String PREFS = "fn_rotulos";

    private Rotulos() { }

    static String get(Context c, String k, String def) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(k, def);
    }

    static void salvar(Context c, JSONObject o) {
        if (o == null) return;
        SharedPreferences.Editor e = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        Iterator<String> keys = o.keys();
        while (keys.hasNext()) {
            String k = keys.next();
            String v = o.optString(k, "");
            if (v.length() > 0) e.putString(k, v);
        }
        e.apply();
    }

    /** An intent that opens the app straight into a moment: pico, paz, cochilo, madrugada. */
    static Intent abrir(Context c, String acao) {
        Intent i = new Intent(c, MainActivity.class);
        i.setAction(Intent.ACTION_VIEW);
        i.setData(Uri.parse("fornow://" + acao));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return i;
    }

    /** Shortcuts shown when the app icon is held, in the app's language. */
    static void atualizarAtalhos(Context c) {
        if (Build.VERSION.SDK_INT < 25) return;
        try {
            ShortcutManager sm = c.getSystemService(ShortcutManager.class);
            if (sm == null) return;
            String[][] itens = {
                    {"pico", get(c, "pico", "It's hard right now")},
                    {"paz", get(c, "paz", "A little peace")},
                    {"cochilo", get(c, "cochilo", "Nap")},
                    {"madrugada", get(c, "madrugada", "Awake in the night")},
            };
            int max = Math.max(1, Math.min(4, sm.getMaxShortcutCountPerActivity()));
            List<ShortcutInfo> lista = new ArrayList<>();
            for (int k = 0; k < itens.length && k < max; k++) {
                lista.add(new ShortcutInfo.Builder(c, itens[k][0])
                        .setShortLabel(curto(itens[k][1]))
                        .setLongLabel(itens[k][1])
                        .setIcon(Icon.createWithResource(c, R.mipmap.ic_launcher))
                        .setIntent(abrir(c, itens[k][0]))
                        .setRank(k)
                        .build());
            }
            sm.setDynamicShortcuts(lista);
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "shortcuts", e);
        }
    }

    private static String curto(String s) {
        return s.length() <= 24 ? s : s.substring(0, 23) + "…";
    }

    static void atualizarWidgets(Context c) {
        try {
            AppWidgetManager m = AppWidgetManager.getInstance(c);
            if (m == null) return;
            int[] ids = m.getAppWidgetIds(new ComponentName(c, PicoWidget.class));
            if (ids != null && ids.length > 0) PicoWidget.atualizar(c, m, ids);
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "widgets", e);
        }
    }

    static void atualizarBloco(Context c) {
        if (Build.VERSION.SDK_INT < 24) return;
        try {
            TileService.requestListeningState(c, new ComponentName(c, PicoTile.class));
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "tile", e);
        }
    }
}
