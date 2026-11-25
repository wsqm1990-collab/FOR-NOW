package com.wsqm1990.fornow;

import android.content.Context;
import android.media.AudioAttributes;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;

import java.util.ArrayList;
import java.util.Locale;

/**
 * The phone's own text-to-speech voice, on the media volume. The session service decides
 * when to speak; this class only says one sentence at a time (a new one replaces the last).
 */
final class Fala implements TextToSpeech.OnInitListener {
    private static Fala inst;

    static synchronized Fala get(Context c) {
        if (inst == null) inst = new Fala(c.getApplicationContext());
        return inst;
    }

    private final Context ctx;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ArrayList<Object[]> pendentes = new ArrayList<>();
    private TextToSpeech tts;
    private boolean pronto = false, falhou = false;
    private String idiomaAplicado = "";
    private int contador = 0;

    private Fala(Context c) {
        ctx = c;
        iniciar();
    }

    private void iniciar() {
        try {
            pronto = false;
            falhou = false;
            idiomaAplicado = "";
            tts = new TextToSpeech(ctx, this);
        } catch (Exception e) {
            falhou = true;
            Log.w(ForNowPlugin.TAG, "tts create failed", e);
        }
    }

    @Override
    public synchronized void onInit(int status) {
        pronto = status == TextToSpeech.SUCCESS;
        Log.i(ForNowPlugin.TAG, "tts init status=" + status);
        if (!pronto) {
            falhou = true;
            pendentes.clear();
            return;
        }
        try {
            tts.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build());
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "tts attributes", e);
        }
        for (Object[] p : pendentes) falarAgora((String) p[0], (String) p[1], (Float) p[2], (Float) p[3]);
        pendentes.clear();
    }

    synchronized void preparar(String lang) {
        if (pronto) aplicarIdioma(lang);
        else if (falhou) iniciar();
    }

    synchronized void dizer(String texto, String lang, float rate, float volume) {
        if (texto == null || texto.trim().length() == 0) return;
        if (falhou) iniciar();
        if (!pronto) {
            pendentes.clear(); // only the newest sentence matters
            pendentes.add(new Object[]{texto, lang, rate, volume});
            return;
        }
        falarAgora(texto, lang, rate, volume);
    }

    synchronized void calar() {
        pendentes.clear();
        try { if (tts != null && pronto) tts.stop(); } catch (Exception ignored) { }
    }

    private void aplicarIdioma(String l) {
        if (tts == null || l == null || l.equals(idiomaAplicado)) return;
        try {
            Locale loc = Locale.forLanguageTag(l);
            int r = tts.setLanguage(loc);
            if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) r = tts.setLanguage(new Locale(loc.getLanguage()));
            idiomaAplicado = l;
            Log.i(ForNowPlugin.TAG, "tts language " + l + " result=" + r);
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "tts language", e);
        }
    }

    private void falarAgora(String texto, String lang, float rate, float volume) {
        try {
            aplicarIdioma(lang);
            tts.setSpeechRate(Math.max(0.5f, Math.min(1.5f, rate)));
            Bundle params = new Bundle();
            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, Math.max(0.1f, Math.min(1f, volume)));
            int r = tts.speak(texto, TextToSpeech.QUEUE_FLUSH, params, "fn" + (++contador));
            Log.i(ForNowPlugin.TAG, "fala result=" + r + " lang=" + lang + " text=" + texto);
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "speak failed", e);
        }
    }

    /** Is there a voice for this language? Waits a little for the engine to start. */
    void status(final String lang, final PluginCall call) {
        final long t0 = System.currentTimeMillis();
        handler.post(new Runnable() {
            @Override public void run() {
                synchronized (Fala.this) {
                    if (!pronto && !falhou && System.currentTimeMillis() - t0 < 4000) { handler.postDelayed(this, 200); return; }
                    JSObject r = new JSObject();
                    if (!pronto) {
                        r.put("status", "sem_motor");
                        r.put("motor", "");
                    } else {
                        int a = TextToSpeech.LANG_NOT_SUPPORTED;
                        try { a = tts.isLanguageAvailable(Locale.forLanguageTag(lang)); } catch (Exception ignored) { }
                        r.put("status", a >= TextToSpeech.LANG_AVAILABLE ? "ok" : "falta");
                        String motor = "";
                        try { motor = tts.getDefaultEngine(); } catch (Exception ignored) { }
                        r.put("motor", motor == null ? "" : motor);
                    }
                    call.resolve(r);
                }
            }
        });
    }
}
