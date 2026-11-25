package com.wsqm1990.fornow;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.text.DateFormat;
import java.util.Date;

/**
 * Rings the alarm: a soft sound that grows slowly (on the alarm volume), a gentle vibration after
 * a while, a full-screen "Turn off" screen and a notification with the same button.
 * It stops by itself after 10 minutes.
 */
public class AlarmeService extends Service {
    static final String ACTION_TOCAR = "com.wsqm1990.fornow.ALARME_TOCAR";
    static final String ACTION_DESLIGAR = "com.wsqm1990.fornow.ALARME_DESLIGAR";
    static final String CHANNEL = "fn_alarme";
    static final int NOTIF_ID = 5201;
    private static final long DURACAO_MAXIMA = 10L * 60L * 1000L;
    private static final long SUBIDA_MS = 45000L;

    static volatile AlarmeService instance;

    private final Handler h = new Handler(Looper.getMainLooper());
    private MediaPlayer mp;
    private PowerManager.WakeLock wl;
    private AudioManager am;
    private AudioFocusRequest focusReq;
    private String tipo = "cochilo";
    private long at = 0, inicio = 0;
    private boolean tocando = false;

    static boolean tocando() { AlarmeService s = instance; return s != null && s.tocando; }

    static boolean tocandoTipo(String t) { AlarmeService s = instance; return s != null && s.tocando && t != null && t.equals(s.tipo); }

    /** Turn the alarm off (from the page, the alarm screen or the notification). */
    static void desligar(Context c) {
        final AlarmeService s = instance;
        if (s != null) { s.h.post(new Runnable() { @Override public void run() { s.parar(true); } }); return; }
        try { c.startService(new Intent(c, AlarmeService.class).setAction(ACTION_DESLIGAR)); } catch (Exception ignored) { }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        instance = this;
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_TOCAR.equals(action)) {
            if (tocando) pararSom();
            tipo = intent.getStringExtra("tipo");
            if (tipo == null) tipo = "cochilo";
            at = intent.getLongExtra("at", System.currentTimeMillis());
            inicio = System.currentTimeMillis();
            garantirCanal();
            try {
                if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF_ID, notificacao(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
                else startForeground(NOTIF_ID, notificacao());
            } catch (Exception e) {
                Log.e(ForNowPlugin.TAG, "alarm startForeground failed", e);
            }
            tocando = true;
            tocar();
            abrirTela();
            emitir("tocando");
            h.postDelayed(new Runnable() { @Override public void run() { parar(false); } }, DURACAO_MAXIMA);
        } else if (ACTION_DESLIGAR.equals(action)) {
            parar(true);
        } else if (!tocando) {
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        h.removeCallbacksAndMessages(null);
        pararSom();
        if (instance == this) instance = null;
        super.onDestroy();
    }

    private void tocar() {
        am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        pedirFoco(attrs);
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ForNow:alarme");
                wl.setReferenceCounted(false);
                wl.acquire(DURACAO_MAXIMA + 60000L);
            }
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "alarm wake lock", e);
        }
        try {
            mp = new MediaPlayer();
            mp.setAudioAttributes(attrs);
            try (AssetFileDescriptor fd = getResources().openRawResourceFd(R.raw.fn_alarme)) {
                mp.setDataSource(fd.getFileDescriptor(), fd.getStartOffset(), fd.getLength());
            }
            mp.setLooping(true);
            mp.prepare();
            mp.setVolume(0.08f, 0.08f);
            mp.start();
            subir();
        } catch (Exception e) {
            Log.e(ForNowPlugin.TAG, "alarm sound failed", e);
        }
        /* a gentle vibration joins after 20 seconds */
        h.postDelayed(new Runnable() { @Override public void run() { if (tocando) vibrar(); } }, 20000);
    }

    private void subir() {
        h.post(new Runnable() {
            @Override public void run() {
                if (!tocando || mp == null) return;
                float f = Math.min(1f, 0.08f + (System.currentTimeMillis() - inicio) / (float) SUBIDA_MS);
                try { mp.setVolume(f, f); } catch (Exception ignored) { }
                if (f < 1f) h.postDelayed(this, 500);
            }
        });
    }

    @SuppressWarnings("deprecation")
    private Vibrator vibrador() {
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return vm == null ? null : vm.getDefaultVibrator();
        }
        return (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
    }

    @SuppressWarnings("deprecation")
    private void vibrar() {
        try {
            Vibrator v = vibrador();
            if (v == null || !v.hasVibrator()) return;
            long[] padrao = {0, 350, 1400};
            AudioAttributes aa = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build();
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(padrao, 0), aa);
            else v.vibrate(padrao, 0, aa);
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "vibrate", e);
        }
    }

    @SuppressWarnings("deprecation")
    private void pedirFoco(AudioAttributes attrs) {
        if (am == null) return;
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                focusReq = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(attrs).build();
                am.requestAudioFocus(focusReq);
            } else {
                am.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
            }
        } catch (Exception ignored) { }
    }

    @SuppressWarnings("deprecation")
    private void pararSom() {
        if (mp != null) {
            try { mp.stop(); } catch (Exception ignored) { }
            try { mp.release(); } catch (Exception ignored) { }
            mp = null;
        }
        try { Vibrator v = vibrador(); if (v != null) v.cancel(); } catch (Exception ignored) { }
        try {
            if (am != null) {
                if (Build.VERSION.SDK_INT >= 26) { if (focusReq != null) am.abandonAudioFocusRequest(focusReq); }
                else am.abandonAudioFocus(null);
            }
        } catch (Exception ignored) { }
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception ignored) { }
    }

    void parar(boolean pelaPessoa) {
        if (!tocando) { stopSelf(); return; }
        tocando = false;
        h.removeCallbacksAndMessages(null);
        pararSom();
        long agora = System.currentTimeMillis();
        if (pelaPessoa) Despertador.marcar(this, tipo, at, "desligado", agora);
        else Despertador.marcar(this, tipo, at, "estado", "parou_sozinho");
        Log.i(ForNowPlugin.TAG, "alarme parou tipo=" + tipo + " pelaPessoa=" + pelaPessoa);
        emitir(pelaPessoa ? "desligado" : "parou");
        AlarmeActivity.fechar();
        try {
            if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE);
            else stopForeground(true);
        } catch (Exception ignored) { }
        stopSelf();
    }

    private void emitir(String tipoEvento) {
        JSONObject o = new JSONObject();
        try { o.put("type", tipoEvento); o.put("tipo", tipo); o.put("at", at); } catch (Exception ignored) { }
        ForNowPlugin.emit("alarme", o);
    }

    private void abrirTela() {
        try {
            Intent i = new Intent(this, AlarmeActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
            startActivity(i);
        } catch (Exception e) {
            Log.i(ForNowPlugin.TAG, "alarm screen via notification only: " + e.getMessage());
        }
    }

    private void garantirCanal() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, Rotulos.get(this, "alarmChannel", "Alarm"), NotificationManager.IMPORTANCE_HIGH);
        ch.setSound(null, null); /* the sound comes from this service, on the alarm volume */
        ch.enableVibration(false);
        ch.setBypassDnd(true);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    private Notification notificacao() {
        Intent tela = new Intent(this, AlarmeActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
        PendingIntent telaPi = PendingIntent.getActivity(this, 301, tela, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent off = PendingIntent.getService(this, 302, new Intent(this, AlarmeService.class).setAction(ACTION_DESLIGAR),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String titulo = "teste".equals(tipo) ? Rotulos.get(this, "alarmTest", "Alarm test") : Rotulos.get(this, "alarmTitle", "Time to wake up");
        String hora = DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date(at > 0 ? at : System.currentTimeMillis()));
        return new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_fn)
                .setColor(0xFF2F5D5A)
                .setContentTitle(titulo)
                .setContentText(hora)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setOngoing(true)
                .setAutoCancel(false)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setFullScreenIntent(telaPi, true)
                .setContentIntent(telaPi)
                .addAction(0, Rotulos.get(this, "alarmOff", "Turn off"), off)
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
                .build();
    }
}
