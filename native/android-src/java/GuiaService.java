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
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Plays a session (one sentence at a time, with pauses, plus a background sound) as a
 * foreground service, so the voice keeps going with the screen locked. The page sends the
 * whole timeline once; after that this service owns the clock.
 * Time model (same as the page): elapsed = (pausedAt || now) - start - pausedTotal.
 * A phone call or unplugged headphones pause it; it never resumes by itself.
 * Each sentence can come with a recorded voice clip (from the APK); without one the phone's own
 * voice reads it. The background can be one sound that loops or a list of songs that follow each
 * other with a crossfade. The background gets quieter while the voice speaks and fades out at the end.
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
    private MediaPlayer vozMp;         // the recorded voice of the current sentence
    /** The background: one or more layers playing together (a mix), each with its own volume. */
    private final java.util.ArrayList<Camada> camadas = new java.util.ArrayList<>();
    private long ultimaMistura = 0;

    /** One background layer: a sound that repeats, a list of songs that follow each other, or a tone made here. */
    private static final class Camada {
        String[] lista = new String[0];
        int faixa = 0;
        MediaPlayer atual, proximo;    // playing now / the next one, while they cross
        Tom tom;                       // a binaural beat or a frequency, made on the phone (no file, no joint)
        long cruzIni = 0, cruzMs = 5000;
        float alvo = 1f, vol = 1f;     // this layer's volume (from the page) and where it is now
        boolean saindo = false;        // fading out, to be removed
        String chave() { return lista.length > 0 ? lista[0] : ""; }
    }
    private float volAtual = 0f, volVoz = 1f, volSom = VOL_AMBIENTE, focoFator = 1f;
    private boolean receptorLigado = false;

    private String id = "", lang = "en-US", som = "silencio";
    private boolean voz = true, running = false;
    private float rate = 0.9f, volume = 1f;
    private long[] durMs = new long[0];
    private String[] textos = new String[0];
    private String[] clips = new String[0];
    private int[] vibs = new int[0];
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
        pararClipe();
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
            calar();
            pararAmbiente();
            id = o.optString("id", "");
            lang = o.optString("lang", "en-US");
            som = o.optString("som", "silencio");
            voz = o.optBoolean("voz", true);
            rate = (float) o.optDouble("rate", 0.9);
            volume = (float) o.optDouble("volume", 1.0);
            volVoz = (float) o.optDouble("volVoz", volume);
            volSom = (float) o.optDouble("volSom", VOL_AMBIENTE * volume);
            fimFade = o.optLong("fimFade", 0);
            java.util.ArrayList<Camada> novas = lerCamadas(o, som);
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
            clips = new String[n];
            vibs = new int[n];
            totalMs = 0;
            for (int i = 0; i < n; i++) {
                JSONObject s = ps.optJSONObject(i);
                if (s == null) s = new JSONObject();
                durMs[i] = Math.max(300L, Math.round(s.optDouble("s", 1) * 1000.0));
                textos[i] = s.optString("t", "");
                clips[i] = s.optString("a", "");
                vibs[i] = s.optInt("v", 0);
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
            camadas.addAll(novas);
            tocarCamadas(true);
            garantirCanal();
            entrarEmPrimeiroPlano(notificacao());
            segurarCpu();
            salvarEstado(false, false, 0);
            handler.post(tick);
            Log.i(ForNowPlugin.TAG, "guia start id=" + id + " passos=" + n + " som=" + som + " lista=" + principalTam() + " camadas=" + camadas.size() + " voz=" + voz + " total=" + totalMs);
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
                if (p > 0 && pausadoEm == 0) { pausadoEm = p; calar(); pausarAmbiente(); }
                else if (p == 0 && pausadoEm > 0) { pausadoEm = 0; pedirFoco(); retomarAmbiente(); }
            }
            if (o.has("voz")) { voz = o.optBoolean("voz", voz); if (!voz) calar(); }
            if (o.has("volSom")) volSom = (float) o.optDouble("volSom", volSom);
            if (o.has("volVoz")) { volVoz = (float) o.optDouble("volVoz", volVoz); try { if (vozMp != null) vozMp.setVolume(volVoz, volVoz); } catch (Exception ignored) { } }
            if (o.has("camadas")) {
                // a mix being made: layers come in, go out and change volume smoothly, nothing restarts
                misturarAoVivo(lerCamadas(o, o.optString("som", som)));
                som = o.optString("som", som);
            } else if (o.has("som") || o.has("sons")) {
                String s = o.optString("som", som);
                String[] nova = lerLista(o, s);
                Camada c0 = camadas.isEmpty() ? null : camadas.get(0);
                if (camadas.size() != 1 || c0 == null || !java.util.Arrays.equals(nova, c0.lista)) {
                    som = s;
                    pararAmbiente();
                    Camada c = new Camada();
                    c.lista = nova;
                    camadas.add(c);
                    tocarCamadas(true);
                    if (pausadoEm > 0) pausarAmbiente();
                }
            }
            if (o.optBoolean("proxima", false) && pausadoEm == 0) pularFaixa();
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
            calar();
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
        calar();
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
            if (pausadoEm == 0) {
                if (vibs[i] > 0) vibrar(vibs[i]);
                falarPasso(i);
            }
        }
        if (pausadoEm == 0) misturar(totalMs - e);
        // finer steps while tracks cross or layers glide, so it stays smooth
        handler.postDelayed(tick, pausadoEm > 0 ? 1000 : emMovimento() ? 40 : 200);
    }

    private void falarPasso(int i) {
        if (!voz || i < 0 || i >= textos.length) return;
        if (clips[i] != null && clips[i].length() > 0 && tocarClipe(clips[i])) return;
        String t = textos[i];
        if (t != null && t.length() > 0) Fala.get(this).dizer(t, lang, rate, volVoz);
    }

    /** Stops whatever voice is speaking: the recorded clip and the phone's voice. */
    private void calar() {
        Fala.get(this).calar();
        pararClipe();
    }

    private boolean tocarClipe(String nome) {
        pararClipe();
        final MediaPlayer p = new MediaPlayer();
        try {
            p.setAudioAttributes(atributos());
            if (!Fontes.abrir(this, p, nome)) { p.release(); return false; }
            p.prepare();
            p.setVolume(volVoz, volVoz);
            p.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override public void onCompletion(MediaPlayer mp) { if (vozMp == mp) pararClipe(); }
            });
            p.start();
            vozMp = p;
            Log.i(ForNowPlugin.TAG, "clip " + nome);
            return true;
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "clip " + nome, e);
            try { p.release(); } catch (Exception ignored) { }
            return false;
        }
    }

    private void pararClipe() {
        MediaPlayer p = vozMp;
        vozMp = null;
        if (p == null) return;
        try { p.stop(); } catch (Exception ignored) { }
        try { p.release(); } catch (Exception ignored) { }
    }

    private boolean falando() {
        try { return vozMp != null && vozMp.isPlaying(); } catch (Exception e) { return false; }
    }

    @SuppressWarnings("deprecation")
    private void vibrar(int ms) {
        try {
            Vibrator v;
            if (Build.VERSION.SDK_INT >= 31) {
                VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                v = vm == null ? null : vm.getDefaultVibrator();
            } else {
                v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (v == null || !v.hasVibrator()) return;
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(Math.min(ms, 400), VibrationEffect.DEFAULT_AMPLITUDE));
            else v.vibrate(Math.min(ms, 400));
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "vibrate", e);
        }
    }

    private void encerrar(boolean completo, String por) {
        if (!running) return;
        running = false;
        handler.removeCallbacks(tick);
        long fim = pausadoEm > 0 ? pausadoEm : System.currentTimeMillis();
        if (completo) apagarAmbiente(1500);
        else { calar(); pararAmbiente(); }
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
            Camada p = principal();
            o.put("faixa", p == null ? 0 : p.faixa);
            o.put("faixas", p == null ? 0 : p.lista.length);
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

    /** The background list of one layer: "sons" (several, in turn) or "som" (one, repeating). */
    private static String[] lerLista(JSONObject o, String somUnico) {
        JSONArray a = o.optJSONArray("sons");
        if (a != null) {
            java.util.ArrayList<String> l = new java.util.ArrayList<>();
            for (int i = 0; i < a.length(); i++) { String x = a.optString(i, ""); if (x.length() > 0 && !"silencio".equals(x)) l.add(x); }
            return l.toArray(new String[0]);
        }
        if (somUnico == null || somUnico.length() == 0 || "silencio".equals(somUnico)) return new String[0];
        return new String[] { somUnico };
    }

    /** The layers of a plan: "camadas" [{sons|som, vol}] for a mix, or one layer from "sons"/"som". */
    private static java.util.ArrayList<Camada> lerCamadas(JSONObject o, String som) {
        java.util.ArrayList<Camada> out = new java.util.ArrayList<>();
        JSONArray cs = o.optJSONArray("camadas");
        if (cs != null) {
            for (int i = 0; i < cs.length(); i++) {
                JSONObject c = cs.optJSONObject(i);
                if (c == null) continue;
                Camada k = new Camada();
                k.lista = lerLista(c, c.optString("som", ""));
                k.alvo = k.vol = (float) Math.max(0, Math.min(1, c.optDouble("vol", 1)));
                if (k.lista.length > 0) out.add(k);
            }
            return out;
        }
        Camada k = new Camada();
        k.lista = lerLista(o, som);
        if (k.lista.length > 0) out.add(k);
        return out;
    }

    /** The layer the page shows as "now playing" (the one with a list of songs, or the first). */
    private Camada principal() {
        for (Camada c : camadas) if (c.lista.length > 1 && !c.saindo) return c;
        for (Camada c : camadas) if (!c.saindo) return c;
        return null;
    }

    private int principalTam() { Camada p = principal(); return p == null ? 0 : p.lista.length; }

    /**
     * Opens one track. Nothing loops inside the player (Android's own looping leaves a small gap
     * at the joint): a sound that repeats is joined to a new copy of itself with a tiny crossfade,
     * and a song passes into the next one slowly. See misturar().
     */
    private MediaPlayer abrirFaixa(String nome) {
        MediaPlayer mp = new MediaPlayer();
        try {
            mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build());
            if (!Fontes.abrir(this, mp, nome)) { mp.release(); return null; }
            mp.setLooping(false);
            mp.prepare();
            mp.setVolume(0f, 0f);
            mp.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override public void onCompletion(MediaPlayer m) {
                    if (!running || pausadoEm != 0) return;
                    for (Camada c : camadas) {
                        if (c.atual != m) continue;
                        if (c.proximo != null) terminarCruzamento(c);   // the next copy is already playing: it takes over now
                        else seguir(c, 150);                            // the joint was missed: go on at once
                        return;
                    }
                }
            });
            return mp;
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "som " + nome, e);
            try { mp.release(); } catch (Exception ignored) { }
            return null;
        }
    }

    /** Starts every layer from its current track (the whole background fades in through misturar). */
    private void tocarCamadas(boolean doZero) {
        ultimaMistura = 0;
        if (doZero) volAtual = 0f;
        for (Camada c : camadas) iniciarCamada(c);
    }

    private void iniciarCamada(Camada c) {
        int n = c.lista.length;
        if (n > 0 && Tom.eh(c.lista[0])) {
            Tom t = Tom.de(c.lista[0]);
            if (t == null) return;
            t.volume(volAtual * c.vol);
            t.tocar();
            c.tom = t;
            Log.i(ForNowPlugin.TAG, "som " + c.lista[0] + " (1/1)");
            return;
        }
        for (int tent = 0; tent < n; tent++) {
            int k = (c.faixa + tent) % n;
            MediaPlayer mp = abrirFaixa(c.lista[k]);
            if (mp == null) continue;
            c.faixa = k;
            float v = volAtual * c.vol;
            try { mp.setVolume(v, v); mp.start(); } catch (Exception ignored) { }
            c.atual = mp;
            Log.i(ForNowPlugin.TAG, "som " + c.lista[k] + " (" + (k + 1) + "/" + n + ")");
            return;
        }
    }

    /** A mix being made on the page: new layers fade in, removed ones fade out, volumes glide. */
    private void misturarAoVivo(java.util.ArrayList<Camada> novas) {
        java.util.ArrayList<Camada> ficam = new java.util.ArrayList<>();
        for (Camada nova : novas) {
            Camada igual = null;
            for (Camada c : camadas) if (!c.saindo && !ficam.contains(c) && java.util.Arrays.equals(c.lista, nova.lista)) { igual = c; break; }
            if (igual != null) { igual.alvo = nova.alvo; ficam.add(igual); continue; }
            nova.vol = 0f;                       // comes in from silence
            camadas.add(nova);
            ficam.add(nova);
            if (pausadoEm == 0) iniciarCamada(nova);
        }
        for (Camada c : camadas) if (!ficam.contains(c)) c.saindo = true;
        Log.i(ForNowPlugin.TAG, "mix " + ficam.size() + " camadas");
    }

    /** Next song now, with a short crossfade (the "next" button). */
    private void pularFaixa() {
        Camada c = principal();
        if (c == null || c.lista.length < 2 || c.atual == null) return;
        if (c.proximo != null) terminarCruzamento(c);
        comecarCruzamento(c, 2000);
    }

    /** Goes on to what comes next (the next song, or the same sound again) over ms. */
    private void seguir(Camada c, long ms) {
        if (c.atual == null || c.lista.length == 0) return;
        if (c.proximo != null) terminarCruzamento(c);
        comecarCruzamento(c, ms);
    }

    /** Starts the next track (or, with one sound, a new copy of it) silent; misturar() brings it up. */
    private void comecarCruzamento(Camada c, long ms) {
        int n = c.lista.length;
        for (int tent = 1; tent <= n; tent++) {
            int k = (c.faixa + tent) % n;
            MediaPlayer mp = abrirFaixa(c.lista[k]);
            if (mp == null) continue;
            try { mp.start(); } catch (Exception ignored) { }
            c.proximo = mp;
            c.faixa = k;
            c.cruzIni = System.currentTimeMillis();
            c.cruzMs = Math.max(100, ms);
            Log.i(ForNowPlugin.TAG, (n == 1 ? "som laço " : "som ") + c.lista[k] + " (" + (k + 1) + "/" + n + ")");
            return;
        }
    }

    private void terminarCruzamento(Camada c) {
        MediaPlayer velho = c.atual;
        c.atual = c.proximo;
        c.proximo = null;
        c.cruzIni = 0;
        float v = volAtual * c.vol;
        try { if (c.atual != null) c.atual.setVolume(v, v); } catch (Exception ignored) { }
        soltar(velho);
        if (c.lista.length > 1 && c == principal()) ForNowPlugin.emit("guia", estadoJson("state"));
    }

    private static void soltar(MediaPlayer mp) {
        if (mp == null) return;
        try { mp.stop(); } catch (Exception ignored) { }
        try { mp.release(); } catch (Exception ignored) { }
    }

    private boolean emMovimento() {
        for (Camada c : camadas) {
            if (c.proximo != null) return true;
            if (Math.abs((c.saindo ? 0f : c.alvo) - c.vol) > 0.001f) return true;
        }
        return false;
    }

    /**
     * Sets the background volume every tick: fades in at the start, gets quieter while a voice clip
     * plays, fades out over the last fimFade ms, glides each layer to its own volume, and joins
     * repeating sounds and songs (see comecarCruzamento).
     */
    private void misturar(long faltaMs) {
        if (camadas.isEmpty()) return;
        long agora = System.currentTimeMillis();
        float dt = ultimaMistura == 0 ? 1f : Math.min(5f, (agora - ultimaMistura) / 200f);   // ramps keep their speed
        ultimaMistura = agora;
        float alvo = volSom * focoFator;
        if (falando()) alvo *= 0.55f;
        if (fimFade > 0 && faltaMs < fimFade) alvo *= Math.max(0f, faltaMs / (float) fimFade);
        float passo = (alvo < volAtual ? 0.06f : 0.035f) * dt;
        if (Math.abs(alvo - volAtual) <= passo) volAtual = alvo;
        else volAtual += alvo > volAtual ? passo : -passo;

        java.util.Iterator<Camada> it = camadas.iterator();
        while (it.hasNext()) {
            Camada c = it.next();
            // each layer glides to its own volume in about a second and a half
            float meta = c.saindo ? 0f : c.alvo, pc = 0.13f * dt;
            if (Math.abs(meta - c.vol) <= pc) c.vol = meta;
            else c.vol += meta > c.vol ? pc : -pc;
            if (c.saindo && c.vol <= 0f) { soltar(c.atual); soltar(c.proximo); if (c.tom != null) c.tom.soltar(); it.remove(); continue; }
            if (c.tom != null) { c.tom.volume(volAtual * c.vol); continue; }
            if (c.atual == null) continue;
            if (c.proximo == null) {
                try {
                    int dur = c.atual.getDuration(), pos = c.atual.getCurrentPosition();
                    // a song passes slowly into the next (its own ending fades under the new one);
                    // a repeating sound joins a new copy of itself with a crossfade too short to hear
                    long junta = dur > 60000 && c.lista.length > 1 || dur > 120000 ? 12000 : 600;
                    if (dur > 0 && dur - pos <= junta) comecarCruzamento(c, Math.max(junta > 600 ? 1500 : 120, dur - pos - 60));
                } catch (Exception ignored) { }
            }
            float base = volAtual * c.vol, gVelho = 1f;
            if (c.proximo != null) {
                float w = Math.max(0f, Math.min(1f, (agora - c.cruzIni) / (float) c.cruzMs));
                // equal power: the two together stay as loud as one the whole way
                float gNovo = (float) Math.sin(w * Math.PI / 2);
                gVelho = (float) Math.cos(w * Math.PI / 2);
                try { c.proximo.setVolume(base * gNovo, base * gNovo); } catch (Exception ignored) { }
                if (w >= 1f) { terminarCruzamento(c); gVelho = 1f; }
            }
            float vA = base * gVelho;
            try { if (c.atual != null) c.atual.setVolume(vA, vA); } catch (Exception ignored) { }
        }
    }

    private void apagarAmbiente(final long ms) {
        final java.util.ArrayList<MediaPlayer> mps = new java.util.ArrayList<>();
        final java.util.ArrayList<Float> vs = new java.util.ArrayList<>();
        final java.util.ArrayList<Tom> tons = new java.util.ArrayList<>();
        final java.util.ArrayList<Float> vts = new java.util.ArrayList<>();
        for (Camada c : camadas) {
            if (c.proximo != null) terminarCruzamento(c);
            if (c.atual != null) { mps.add(c.atual); vs.add(volAtual * c.vol); }
            if (c.tom != null) { tons.add(c.tom); vts.add(volAtual * c.vol); }
        }
        camadas.clear();
        if (mps.isEmpty() && tons.isEmpty()) return;
        final long t0 = System.currentTimeMillis();
        handler.post(new Runnable() {
            @Override public void run() {
                float f = 1f - Math.min(1f, (System.currentTimeMillis() - t0) / (float) ms);
                for (int i = 0; i < mps.size(); i++) { try { mps.get(i).setVolume(vs.get(i) * f, vs.get(i) * f); } catch (Exception ignored) { } }
                for (int i = 0; i < tons.size(); i++) tons.get(i).volume(vts.get(i) * f);
                if (f > 0f) handler.postDelayed(this, 80);
                else { for (MediaPlayer mp : mps) soltar(mp); for (Tom t : tons) t.soltar(); }
            }
        });
    }

    private void pausarAmbiente() {
        for (Camada c : camadas) {
            if (c.proximo != null) terminarCruzamento(c);
            if (c.tom != null) c.tom.pausar();
            try { if (c.atual != null && c.atual.isPlaying()) c.atual.pause(); } catch (Exception ignored) { }
        }
    }

    private void retomarAmbiente() {
        ultimaMistura = 0;
        for (Camada c : camadas) {
            if (c.tom != null) { c.tom.tocar(); continue; }
            if (c.atual == null && !c.saindo) { iniciarCamada(c); continue; }
            try { if (c.atual != null && !c.atual.isPlaying()) c.atual.start(); } catch (Exception ignored) { }
        }
    }

    private void pararAmbiente() {
        for (Camada c : camadas) { soltar(c.atual); soltar(c.proximo); if (c.tom != null) c.tom.soltar(); }
        camadas.clear();
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
        else if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) focoFator = 0.4f;
        else if (change == AudioManager.AUDIOFOCUS_GAIN) focoFator = 1f;
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
