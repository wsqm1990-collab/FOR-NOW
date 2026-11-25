package com.wsqm1990.fornow;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.core.content.ContextCompat;

/** The alarm time arrived: ring, unless it is far too late (then it is only logged). */
public class AlarmeReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        String tipo = intent == null ? null : intent.getStringExtra("tipo");
        if (tipo == null) tipo = "cochilo";
        long agora = System.currentTimeMillis();
        SharedPreferences p = c.getSharedPreferences(Despertador.PREFS, Context.MODE_PRIVATE);
        long at = p.getLong("at_" + tipo, 0);
        p.edit().remove("at_" + tipo).apply();
        if (!Despertador.temAlgum(c)) Despertador.ligarBoot(c, false);
        if (at == 0) {
            Log.i(ForNowPlugin.TAG, "alarme ignorado (cancelado) tipo=" + tipo);
            return;
        }
        if (agora - at > Despertador.ATRASO_MAXIMO) {
            Despertador.marcar(c, tipo, at, "estado", "expirado");
            Log.i(ForNowPlugin.TAG, "alarme expirado tipo=" + tipo + " atraso=" + (agora - at));
            return;
        }
        Despertador.marcar(c, tipo, at, "tocou", agora);
        Despertador.marcar(c, tipo, at, "estado", "tocou");
        Log.i(ForNowPlugin.TAG, "alarme tocou tipo=" + tipo + " previsto=" + at + " real=" + agora + " atraso=" + (agora - at));
        if ("cochilo".equals(tipo)) GuiaService.pararSom(c);
        Intent s = new Intent(c, AlarmeService.class)
                .setAction(AlarmeService.ACTION_TOCAR)
                .putExtra("tipo", tipo)
                .putExtra("at", at);
        try {
            ContextCompat.startForegroundService(c, s);
        } catch (Exception e) {
            Log.e(ForNowPlugin.TAG, "alarm service failed", e);
        }
    }
}
