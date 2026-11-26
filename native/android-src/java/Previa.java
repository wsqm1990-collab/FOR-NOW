package com.wsqm1990.fornow;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

/**
 * A short listen to a sound, a song or a voice while choosing it in the app (only while the app is
 * open). Fades in and out; a new preview replaces the last one.
 */
final class Previa {
    private static final Handler handler = new Handler(Looper.getMainLooper());
    private static MediaPlayer mp;
    private static int geracao = 0;

    private Previa() { }

    static void tocar(Context c, String nome, final long ms, final float vol) {
        parar();
        final int g = ++geracao;
        final MediaPlayer p = new MediaPlayer();
        try {
            p.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
            if (!Fontes.abrir(c.getApplicationContext(), p, nome)) { p.release(); return; }
            p.prepare();
            p.setVolume(0f, 0f);
            p.start();
            mp = p;
            final long t0 = System.currentTimeMillis();
            final long dur = ms > 0 ? ms : 15000;
            handler.post(new Runnable() {
                @Override public void run() {
                    if (g != geracao || mp != p) return;
                    long e = System.currentTimeMillis() - t0;
                    float f = Math.min(1f, e / 600f) * Math.min(1f, Math.max(0f, (dur - e) / 1200f));
                    try { p.setVolume(vol * f, vol * f); } catch (Exception ignored) { }
                    boolean acabou = e >= dur;
                    try { acabou = acabou || !p.isPlaying(); } catch (Exception ignored) { }
                    if (acabou) parar(); else handler.postDelayed(this, 60);
                }
            });
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "previa " + nome, e);
            try { p.release(); } catch (Exception ignored) { }
        }
    }

    static void parar() {
        geracao++;
        MediaPlayer p = mp;
        mp = null;
        if (p == null) return;
        try { p.stop(); } catch (Exception ignored) { }
        try { p.release(); } catch (Exception ignored) { }
    }
}
