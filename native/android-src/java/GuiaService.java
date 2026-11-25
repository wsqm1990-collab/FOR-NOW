package com.wsqm1990.fornow;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
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
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;

/**
 * Plays a session (one sentence at a time, with pauses, plus a background sound) as a
 * foreground service, so the voice keeps going with the screen locked. The page sends the
 * whole timeline once; after that this service owns the clock.
 * Time model (same as the page): elapsed = (pausedAt || now) - start - pausedTotal.
 * A phone call or unplugged headphones pause it; it never resumes by itself.
 */
public class GuiaService extends Service implements AudioManager.OnAudioFocusChangeListener {
    static final String ACTION_START = "com.wsqm1990.fornow.GUIA_START";
    static final String ACTION_TOGGLE = "com.wsqm1990.fornow.GUIA_TOGGLE";
    static final String ACTION_STOP = "com.wsqm1990.fornow.GUIA_STOP";
    static final String EXTRA_PLANO = "plano";
    static final String CHANNEL = "fn_sessao";
    static final int NOTIF_ID = 5101;
    private static final String PREFS = "fn_guia";
    private static final float VOL_AMBIENTE = 0.55f;

    static volatile GuiaService instance;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private PowerManager.WakeLock wakeLock;
    private AudioManager am;
    private AudioFocusRequest focusReq;
    private MediaPlayer ambiente;
    private float volAmb = 0f;
    private boolean receptorLigado = false;

    private String id = "", lang = "en-US", som = "silencio";
    private boolean voz = true, running = false;
    private float rate = 0.9f, volume = 1f;
    private long[] durMs = new long[0];
    private String[] textos = new String[0];
    private long ini, pausa, pausadoEm, totalMs, fimFade;
    private int idx = -1;
    private String lTitle = "For Now", lText = "Session in progress", lPaused = "Paused", lPause = "Pause", lResume = "Resume", lEnd = "End", lChannel = "Sessions";

    private final Runnable tick = new Runnable() { @Override public void run() { onTick(); } };

    private final BroadcastReceiver ruidoso = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) {
            if (i != null && AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(i.getAction())) pausarPorFora("headphones");
        }
    };

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        instance = this;
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_START.equals(action)) {
            garantirCanal();
            entrarEmPrimeiroPlano(notificacao());
            if (!iniciar(intent.getStringExtra(EXTRA_PLANO))) {
                sairDoPrimeiroPlano();
                stopSelf();
            }
        } else if (ACTION_TOGGLE.equals(action)) {
            alternarPausa();
        } else if (ACTION_STOP.equals(action)) {
            encerrar(false, "notification");
        } else if (!running) {
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        pararAmbiente();
        abandonarFoco();
        desligarReceptor();
        soltarCpu();
        if (instance == this) instance = null;
        super.onDestroy();
    }

    void post(Runnable r) { handler.post(r); }

    /** The nap alarm started ringing: the background sound of the nap stops. */
    static void pararSom(Context c) {
        final GuiaService s = instance;
        if (s != null) s.post(new Runnable() { @Override public void run() { s.encerrar(false, "alarme"); } });
    }

    // ---------------------------------------------------------------- plan

    private boolean iniciar(String json) {
        try {
            JSONObject o = new JSONObject(json == null ? "{}" : json);
            JSONArray ps = o.optJSONArray("passos");
            int n = ps == null ? 0 : ps.length();
            if (n == 0) return false;
            handler.removeCallbacks(tick);
            Fala.get(this).calar();
            pararAmbiente();
            id = o.optString("id", "");
            lang = o.optString("lang", "en-US");
            som = o.optString("som", "silencio");
            voz = o.optBoolean("voz", true);
            rate = (float) o.optDouble("rate", 0.9);
            volume = (float) o.optDouble("volume", 1.0);
            fimFade = o.optLong("fimFade", 0);
            JSONObject lb = o.optJSONObject("labels");
            if (lb != null) {
                lTitle = lb.optString("title", lTitle);
                lText = lb.optString("text", lText);
                lPaused = lb.optString("paused", lPaused);
                lPause = lb.optString("pause", lPause);
                lResume = lb.optString("resume", lResume);
                lEnd = lb.optString("end", lEnd);
                lChannel = lb.optString("channel", lChannel);
            }
            durMs = new long[n];
            textos = new String[n];
            totalMs = 0;
            for (int i = 0; i < n; i++) {
                JSONObject s = ps.optJSONObject(i);
                if (s == null) s = new JSONObject();
                durMs[i] = Math.max(500L, Math.round(s.optDouble("s", 1) * 1000.0));
                textos[i] = s.optString("t", "");
                totalMs += durMs[i];
            }
            long now = System.currentTimeMillis();
            ini = o.optLong("ini", now);
            pausa = 0;
            pausadoEm = 0;
            idx = -1;
            running = true;
            Fala.get(this).preparar(lang);
            pedirFoco();
            ligarReceptor();
            tocarAmbiente(som, true);
            garantirCanal();
            entrarEmPrimeiroPlano(notificacao());
            segurarCpu();
            salvarEstado(false, false, 0);
            handler.post(tick);
            Log.i(ForNowPlugin.TAG, "guia start id=" + id + " passos=" + n + " som=" + som + " voz=" + voz + " total=" + totalMs);
            return true;
        } catch (Exception e) {
            Log.e(ForNowPlugin.TAG, "bad plan", e);
            return false;
        }
    }

    /** Changes from the page: pause, resume, voice on/off, another sound. */
    void aplicar(String json) {
        if (!running) return;
        try {
            JSONObject o = new JSONObject(json == null ? "{}" : json);
            if (o.has("id") && !id.equals(o.optString("id", ""))) return;
            if (o.has("pausa")) pausa = o.optLong("pausa", pausa);
            if (o.has("pausadoEm")) {
                long p = o.optLong("pausadoEm", 0);
                if (p > 0 && pausadoEm == 0) { pausadoEm = p; Fala.get(this).calar(); pausarAmbiente(); }
                else if (p == 0 && pausadoEm > 0) { pausadoEm = 0; pedirFoco(); retomarAmbiente(); }
            }
            if (o.has("voz")) { voz = o.optBoolean("voz", voz); if (!voz) Fala.get(this).calar(); }
            if (o.has("som")) {
                String s = o.optString("som", som);
                if (!s.equals(som)) { som = s; tocarAmbiente(som, false); if (pausadoEm > 0) pausarAmbiente(); }
            }
            if (o.optBoolean("refalar", false) && voz && pausadoEm == 0) falarPasso(indiceAtual());
            salvarEstado(false, false, 0);
            handler.removeCallbacks(tick);
            handler.post(tick);
            atualizarNotificacao();
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "bad update", e);
        }
    }

    void pararPeloApp(String qual) {
        if (!running) return;
        if (qual != null && qual.length() > 0 && !qual.equals(id)) return;
        encerrar(false, "app");
    }

    private void alternarPausa() {
        if (!running) return;
        long now = System.currentTimeMillis();
        if (pausadoEm > 0) {
            pausa += now - pausadoEm;
            pausadoEm = 0;
            pedirFoco();
            retomarAmbiente();
            if (voz) falarPasso(indiceAtual());
        } else {
            pausadoEm = now;
            Fala.get(this).calar();
            pausarAmbiente();
        }
        salvarEstado(false, false, 0);
        handler.removeCallbacks(tick);
        handler.post(tick);
        atualizarNotificacao();
        ForNowPlugin.emit("guia", estadoJson("state"));
    }

    private void pausarPorFora(String porque) {
        if (!running || pausadoEm > 0) return;
        pausadoEm = System.currentTimeMillis();
        Fala.get(this).calar();
        pausarAmbiente();
        salvarEstado(false, false, 0);
        atualizarNotificacao();
        ForNowPlugin.emit("guia", estadoJson("state"));
        Log.i(ForNowPlugin.TAG, "guia paused by " + porque);
    }

    private long decorrido() {
        long now = System.currentTimeMillis();
        return Math.max(0, (pausadoEm > 0 ? pausadoEm : now) - ini - pausa);
    }

    private int indiceAtual() {
        long e = decorrido(), acc = 0;
        int i = 0;
        while (i < durMs.length && e >= acc + durMs[i]) { acc += durMs[i]; i++; }
        return Math.min(i, durMs.length - 1);
    }

    // ---------------------------------------------------------------- the clock

    private void onTick() {
        if (!running) return;
        long e = decorrido(), acc = 0;
        int i = 0;
        while (i < durMs.length && e >= acc + durMs[i]) { acc += durMs[i]; i++; }
        if (i >= durMs.length) { encerrar(true, "end"); return; }
        if (i != idx) {
            idx = i;
            if (pausadoEm == 0) falarPasso(i);
        }
        if (fimFade > 0 && ambiente != null && pausadoEm == 0) {
            long falta = totalMs - e;
            if (falta < fimFade) definirVolume(VOL_AMBIENTE * volume * Math.max(0f, falta / (float) fimFade));
        }
        handler.postDelayed(tick, pausadoEm > 0 ? 1000 : 250);
    }

    private void falarPasso(int i) {
        if (!voz || i < 0 || i >= textos.length) return;
        String t = textos[i];
        if (t != null && t.length() > 0) Fala.get(this).dizer(t, lang, rate, volume);
    }

    private void encerrar(boolean completo, String por) {
        if (!running) return;
        running = false;
        handler.removeCallbacks(tick);
        long fim = pausadoEm > 0 ? pausadoEm : System.currentTimeMillis();
        if (completo) apagarAmbiente(1500);
        else { Fala.get(this).calar(); pararAmbiente(); }
        salvarEstado(true, completo, fim);
        JSONObject ev = estadoJson(completo ? "done" : "stopped");
        try { ev.put("by", "notification".equals(por) ? "notification" : por); ev.put("endedAt", fim); ev.put("complete", completo); } catch (Exception ignored) { }
        ForNowPlugin.emit("guia", ev);
        Log.i(ForNowPlugin.TAG, "guia finish complete=" + completo + " by=" + por + " id=" + id);
        abandonarFoco();
        desligarReceptor();
        sairDoPrimeiroPlano();
        soltarCpu();
        handler.postDelayed(new Runnable() { @Override public void run() { if (!running) stopSelf(); } }, 4000);
    }

    // ---------------------------------------------------------------- state shared with the page

    private JSONObject estadoJson(String type) {
        JSONObject o = new JSONObject();
        try {
            o.put("type", type);
            o.put("id", id);
            o.put("ini", ini);
            o.put("pausa", pausa);
            o.put("pausadoEm", pausadoEm);
            o.put("running", running);
        } catch (Exception ignored) { }
        return o;
    }

    private void salvarEstado(boolean terminou, boolean completo, long fim) {
        JSONObject o = estadoJson("state");
        try {
            o.put("ended", terminou);
            o.put("complete", completo);
            o.put("endedAt", fim);
        } catch (Exception ignored) { }
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("state", o.toString()).apply();
    }

    static JSONObject lerEstado(Context ctx) {
        GuiaService s = instance;
        if (s != null && s.running) {
            JSONObject o = s.estadoJson("state");
            try { o.put("ended", false); } catch (Exception ignored) { }
            return o;
        }
        String raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("state", null);
        try {
            JSONObject o = raw == null ? new JSONObject() : new JSONObject(raw);
            o.put("running", false);
            return o;
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    // ---------------------------------------------------------------- background sound

    private void tocarAmbiente(String nome, boolean fadeIn) {
        pararAmbiente();
        if (nome == null || nome.length() == 0 || "silencio".equals(nome)) return;
        MediaPlayer mp = new MediaPlayer();
        try {
            mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build());
            if (!abrirSom(mp, nome)) { mp.release(); return; }
            mp.setLooping(true);
            mp.prepare();
            volAmb = fadeIn ? 0f : VOL_AMBIENTE * volume;
            mp.setVolume(volAmb, volAmb);
            mp.start();
            ambiente = mp;
            if (fadeIn) subirVolume();
            Log.i(ForNowPlugin.TAG, "som " + nome);
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "som " + nome, e);
            try { mp.release(); } catch (Exception ignored) { }
        }
    }

    /** The sound comes from a downloaded update of the page, if there is one, or from the app itself. */
    private boolean abrirSom(MediaPlayer mp, String nome) {
        try {
            String base = getSharedPreferences(ForNowPlugin.BUNDLE_PREFS, Context.MODE_PRIVATE).getString("path", null);
            if (base != null) {
                File f = new File(base, "sons/" + nome + ".ogg");
                if (f.exists()) { mp.setDataSource(f.getAbsolutePath()); return true; }
            }
        } catch (Exception ignored) { }
        try (AssetFileDescriptor fd = getAssets().openFd("public/sons/" + nome + ".ogg")) {
            mp.setDataSource(fd.getFileDescriptor(), fd.getStartOffset(), fd.getLength());
            return true;
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "asset sons/" + nome, e);
            return false;
        }
    }

    private void definirVolume(float v) {
        volAmb = Math.max(0f, Math.min(1f, v));
        try { if (ambiente != null) ambiente.setVolume(volAmb, volAmb); } catch (Exception ignored) { }
    }

    private void subirVolume() {
        final long t0 = System.currentTimeMillis();
        final MediaPlayer alvo = ambiente;
        handler.post(new Runnable() {
            @Override public void run() {
                if (ambiente == null || ambiente != alvo) return;
                float f = Math.min(1f, (System.currentTimeMillis() - t0) / 3000f);
                definirVolume(VOL_AMBIENTE * volume * f);
                if (f < 1f) handler.postDelayed(this, 100);
            }
        });
    }

    private void apagarAmbiente(final long ms) {
        final MediaPlayer mp = ambiente;
        if (mp == null) return;
        ambiente = null;
        final float v0 = volAmb;
        final long t0 = System.currentTimeMillis();
        handler.post(new Runnable() {
            @Override public void run() {
                float f = 1f - Math.min(1f, (System.currentTimeMillis() - t0) / (float) ms);
                try { mp.setVolume(v0 * f, v0 * f); } catch (Exception ignored) { }
                if (f > 0f) handler.postDelayed(this, 80);
                else { try { mp.stop(); } catch (Exception ignored) { } try { mp.release(); } catch (Exception ignored) { } }
            }
        });
    }

    private void pausarAmbiente() { try { if (ambiente != null && ambiente.isPlaying()) ambiente.pause(); } catch (Exception ignored) { } }

    private void retomarAmbiente() { try { if (ambiente != null && !ambiente.isPlaying()) ambiente.start(); } catch (Exception ignored) { } }

    private void pararAmbiente() {
        MediaPlayer mp = ambiente;
        ambiente = null;
        if (mp == null) return;
        try { mp.stop(); } catch (Exception ignored) { }
        try { mp.release(); } catch (Exception ignored) { }
    }

    // ---------------------------------------------------------------- audio focus and headphones

    private AudioAttributes atributos() {
        return new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
    }

    @SuppressWarnings("deprecation")
    private void pedirFoco() {
        if (am == null) return;
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                if (focusReq == null) {
                    focusReq = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                            .setAudioAttributes(atributos())
                            .setOnAudioFocusChangeListener(this, handler)
                            .build();
                }
                am.requestAudioFocus(focusReq);
            } else {
                am.requestAudioFocus(this, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
            }
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "audio focus", e);
        }
    }

    @SuppressWarnings("deprecation")
    private void abandonarFoco() {
        if (am == null) return;
        try {
            if (Build.VERSION.SDK_INT >= 26) { if (focusReq != null) am.abandonAudioFocusRequest(focusReq); }
            else am.abandonAudioFocus(this);
        } catch (Exception ignored) { }
    }

    @Override
    public void onAudioFocusChange(int change) {
        if (change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) pausarPorFora("audio focus");
        else if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) definirVolume(volAmb * 0.4f);
        else if (change == AudioManager.AUDIOFOCUS_GAIN && pausadoEm == 0) definirVolume(VOL_AMBIENTE * volume);
    }

    private void ligarReceptor() {
        if (receptorLigado) return;
        try {
            ContextCompat.registerReceiver(this, ruidoso, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), ContextCompat.RECEIVER_NOT_EXPORTED);
            receptorLigado = true;
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "noisy receiver", e);
        }
    }

    private void desligarReceptor() {
        if (!receptorLigado) return;
        try { unregisterReceiver(ruidoso); } catch (Exception ignored) { }
        receptorLigado = false;
    }

    // ---------------------------------------------------------------- notification (never says what you are doing)

    private void garantirCanal() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, lChannel, NotificationManager.IMPORTANCE_LOW);
        ch.setShowBadge(false);
        ch.setSound(null, null);
        ch.enableVibration(false);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    private void entrarEmPrimeiroPlano(Notification n) {
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            else startForeground(NOTIF_ID, n);
        } catch (Exception e) {
            Log.e(ForNowPlugin.TAG, "startForeground failed", e);
        }
    }

    @SuppressWarnings("deprecation")
    private void sairDoPrimeiroPlano() {
        try {
            if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE);
            else stopForeground(true);
        } catch (Exception ignored) { }
    }

    private Notification notificacao() {
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_fn)
                .setColor(0xFF2F5D5A)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
                .setContentIntent(abrirApp())
                .setContentTitle(lTitle)
                .setContentText(pausadoEm > 0 ? lPaused : lText);
        if (running) {
            b.addAction(0, pausadoEm > 0 ? lResume : lPause, acao(ACTION_TOGGLE, 1));
            b.addAction(0, lEnd, acao(ACTION_STOP, 2));
        }
        return b.build();
    }

    @SuppressLint("MissingPermission")
    private void atualizarNotificacao() {
        if (!running) return;
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(NOTIF_ID, notificacao());
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "notify failed", e);
        }
    }

    private PendingIntent acao(String act, int code) {
        Intent i = new Intent(this, GuiaService.class).setAction(act);
        return PendingIntent.getService(this, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private PendingIntent abrirApp() {
        Intent i = new Intent(this, MainActivity.class);
        i.setAction(Intent.ACTION_MAIN);
        i.addCategory(Intent.CATEGORY_LAUNCHER);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(this, 10, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // ---------------------------------------------------------------- keep the CPU awake with the screen off

    private void segurarCpu() {
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm == null) return;
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ForNow:guia");
                wakeLock.setReferenceCounted(false);
            }
            wakeLock.acquire(Math.max(60000L, totalMs + 10L * 60000L));
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "wake lock", e);
        }
    }

    private void soltarCpu() {
        try { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); } catch (Exception ignored) { }
    }
}
