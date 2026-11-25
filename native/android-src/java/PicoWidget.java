package com.wsqm1990.fornow;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

/** A home screen widget with one big button: one tap opens the session straight away. */
public class PicoWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        atualizar(c, m, ids);
    }

    static void atualizar(Context c, AppWidgetManager m, int[] ids) {
        PendingIntent abrir = PendingIntent.getActivity(c, 501, Rotulos.abrir(c, "pico"),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        for (int id : ids) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.fn_widget_pico);
            v.setTextViewText(R.id.fn_widget_btn, Rotulos.get(c, "widget", c.getString(R.string.fn_widget_padrao)));
            v.setOnClickPendingIntent(R.id.fn_widget_btn, abrir);
            m.updateAppWidget(id, v);
        }
    }
}
