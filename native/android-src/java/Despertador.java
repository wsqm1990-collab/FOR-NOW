package com.wsqm1990.fornow;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSObject;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The nap alarm. Uses AlarmManager.setAlarmClock (the kind Android treats as an alarm clock:
 * never delayed, wakes the phone from low-power modes). Every alarm is written to a small log so
 * the predicted and the real ringing time can be compared on the phone.
 * An alarm that would ring much later than planned (the phone was off) is dropped, never rung.
 */
final class Despertador {
    static final String PREFS = "fn_alarmes";
    static final long ATRASO_MAXIMO = 10L * 60L * 1000L;

    private Despertador() { }

    private static PendingIntent operacao(Context c, String tipo, int flags) {
        Intent i = new Intent(c, AlarmeReceiver.class)
                .setAction("com.wsqm1990.fornow.ALARME." + tipo)
                .putExtra("tipo", tipo);
        return PendingIntent.getBroadcast(c, "teste".equals(tipo) ? 201 : 200, i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent mostrar(Context c) {
        return PendingIntent.getActivity(c, 210, Rotulos.abrir(c, "cochilo"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static boolean podeExato(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return false;
        return Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
    }

    static JSObject agendar(Context c, String tipo, long at) {
        JSObject r = new JSObject();
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) { r.put("ok", false); r.put("erro", "no_alarm_manager"); return r; }
        if (!podeExato(c)) { r.put("ok", false); r.put("erro", "sem_permissao_exata"); return r; }
        if (at < System.currentTimeMillis() + 5000) { r.put("ok", false); r.put("erro", "horario_passado"); return r; }
        try {
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, mostrar(c)), operacao(c, tipo, PendingIntent.FLAG_UPDATE_CURRENT));
            c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putLong("at_" + tipo, at).apply();
            registrar(c, tipo, at);
            ligarBoot(c, true);
            AlarmManager.AlarmClockInfo prox = am.getNextAlarmClock();
            long proxAt = prox != null ? prox.getTriggerTime() : 0;
            boolean nosso = operacao(c, tipo, PendingIntent.FLAG_NO_CREATE) != null;
            r.put("ok", true);
            r.put("at", at);
            r.put("proximo", proxAt);
            /* confirmed only when Android itself reports an alarm clock that rings by then */
            r.put("confirmado", nosso && proxAt > 0 && proxAt <= at + 1000);
            Log.i(ForNowPlugin.TAG, "alarme agendado tipo=" + tipo + " at=" + at + " proximo=" + proxAt);
        } catch (SecurityException e) {
            r.put("ok", false);
            r.put("erro", "sem_permissao_exata");
        } catch (Exception e) {
            r.put("ok", false);
            r.put("erro", String.valueOf(e.getMessage()));
        }
        return r;
    }

    static void cancelar(Context c, String tipo) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent op = operacao(c, tipo, PendingIntent.FLAG_NO_CREATE);
        if (am != null && op != null) { am.cancel(op); op.cancel(); }
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long at = p.getLong("at_" + tipo, 0);
        p.edit().remove("at_" + tipo).apply();
        if (at > 0) marcar(c, tipo, at, "estado", "cancelado");
        if (!temAlgum(c)) ligarBoot(c, false);
        if (AlarmeService.tocandoTipo(tipo)) AlarmeService.desligar(c);
        Log.i(ForNowPlugin.TAG, "alarme cancelado tipo=" + tipo);
    }

    static long proximo(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return 0;
        AlarmManager.AlarmClockInfo prox = am.getNextAlarmClock();
        return prox != null ? prox.getTriggerTime() : 0;
    }

    static boolean temAlgum(Context c) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return p.getLong("at_cochilo", 0) > 0 || p.getLong("at_teste", 0) > 0;
    }

    static void ligarBoot(Context c, boolean on) {
        try {
            c.getPackageManager().setComponentEnabledSetting(new ComponentName(c, BootReceiver.class),
                    on ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED : PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP);
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "boot receiver", e);
        }
    }

    /** After a restart or an update: alarms still in the future come back; past ones are dropped. */
    static void restaurar(Context c) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        for (String tipo : new String[]{"cochilo", "teste"}) {
            long at = p.getLong("at_" + tipo, 0);
            if (at == 0) continue;
            if (at > now + 3000 && podeExato(c)) {
                AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
                try {
                    if (am != null) am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, mostrar(c)), operacao(c, tipo, PendingIntent.FLAG_UPDATE_CURRENT));
                    Log.i(ForNowPlugin.TAG, "alarme restaurado tipo=" + tipo + " at=" + at);
                } catch (Exception e) {
                    Log.w(ForNowPlugin.TAG, "restore", e);
                }
            } else {
                p.edit().remove("at_" + tipo).apply();
                marcar(c, tipo, at, "estado", "expirado");
            }
        }
        if (!temAlgum(c)) ligarBoot(c, false);
    }

    /** Everything the nap screen and the Prepare screen need to know. */
    static JSObject status(Context c, boolean notif) {
        JSObject r = new JSObject();
        r.put("exato", podeExato(c));
        r.put("notif", notif);
        boolean telaCheia = true;
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
                telaCheia = nm == null || nm.canUseFullScreenIntent();
            } catch (Exception ignored) { }
        }
        r.put("telaCheia", telaCheia);
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        r.put("bateria", pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName()));
        AudioManager au = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
        if (au != null) {
            r.put("volumeAlarme", au.getStreamVolume(AudioManager.STREAM_ALARM));
            r.put("volumeAlarmeMax", au.getStreamMaxVolume(AudioManager.STREAM_ALARM));
        }
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) r.put("naoPerturbe", nm.getCurrentInterruptionFilter());
        } catch (Exception ignored) { }
        r.put("proximo", proximo(c));
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        long coch = p.getLong("at_cochilo", 0), teste = p.getLong("at_teste", 0);
        r.put("cochilo", coch > now ? coch : 0);
        r.put("teste", teste > now ? teste : 0);
        r.put("tocando", AlarmeService.tocando());
        r.put("fabricante", Build.MANUFACTURER + " " + Build.BRAND);
        return r;
    }

    static void pedirPermissao(Context c) {
        try {
            Intent i;
            if (Build.VERSION.SDK_INT >= 31) i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + c.getPackageName()));
            else i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + c.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
        } catch (Exception e) {
            try {
                Intent d = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + c.getPackageName()));
                d.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(d);
            } catch (Exception ignored) { }
        }
    }

    // ---------------------------------------------------------------- the log (predicted vs real)

    static synchronized JSONArray log(Context c) {
        try {
            return new JSONArray(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("log", "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private static synchronized void gravar(Context c, JSONArray a) {
        JSONArray b = a;
        if (a.length() > 30) {
            b = new JSONArray();
            for (int i = a.length() - 30; i < a.length(); i++) b.put(a.opt(i));
        }
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("log", b.toString()).apply();
    }

    static synchronized void registrar(Context c, String tipo, long at) {
        JSONArray a = log(c);
        try {
            JSONObject o = new JSONObject();
            o.put("tipo", tipo);
            o.put("previsto", at);
            o.put("marcado", System.currentTimeMillis());
            o.put("estado", "marcado");
            a.put(o);
        } catch (Exception ignored) { }
        gravar(c, a);
    }

    /** Sets one field (tocou, desligado or estado) on the log entry for this alarm. */
    static synchronized void marcar(Context c, String tipo, long at, String campo, Object valor) {
        JSONArray a = log(c);
        for (int i = a.length() - 1; i >= 0; i--) {
            JSONObject o = a.optJSONObject(i);
            if (o != null && tipo.equals(o.optString("tipo")) && o.optLong("previsto") == at) {
                try { o.put(campo, valor); } catch (Exception ignored) { }
                gravar(c, a);
                return;
            }
        }
    }

    static synchronized void limparLog(Context c) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("log").apply();
    }
}
