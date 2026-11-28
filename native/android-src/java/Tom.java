package com.wsqm1990.fornow;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.util.Log;

/**
 * A steady tone made on the phone, for the binaural beats and the frequencies. The name
 * "tom:LEFT:RIGHT:LEVEL:HARMONIC" gives the pitch in each ear in Hz (the same in both, or a few Hz
 * apart for a binaural beat), the peak level (0..0.5) and a soft second harmonic (0 = a pure tone).
 *
 * It is computed sample by sample and never ends, so it has no joint. A recorded tone that repeats
 * would wobble for a moment at every joint: there two copies of the same pitch overlap out of step
 * and partly cancel each other.
 */
final class Tom {
    private static final int SR = 48000;
    private static final int BLOCO = SR / 50;              // 20 ms per write
    private final double passoE, passoD, amp, harm;
    private final AudioTrack track;
    private final Thread fio;
    private final Object trava = new Object();
    private volatile boolean vivo = true, tocando = false;
    private float volume = -1f;

    static boolean eh(String nome) { return nome != null && nome.startsWith("tom:"); }

    /** The tone a name describes, or null (a bad name, or the phone gave no audio track). */
    static Tom de(String nome) {
        try {
            String[] p = nome.substring(4).split(":");
            double e = Double.parseDouble(p[0]), d = Double.parseDouble(p[1]), a = Double.parseDouble(p[2]);
            double h = p.length > 3 ? Double.parseDouble(p[3]) : 0;
            if (!(e >= 20 && e <= 4000 && d >= 20 && d <= 4000 && a > 0 && a <= 0.5 && h >= 0 && h <= 0.5)) {
                Log.w(ForNowPlugin.TAG, "tom fora do limite " + nome);
                return null;
            }
            return new Tom(e, d, a, h);
        } catch (Exception ex) {
            Log.w(ForNowPlugin.TAG, "tom " + nome, ex);
            return null;
        }
    }

    private Tom(double e, double d, double a, double h) {
        passoE = 2 * Math.PI * e / SR;
        passoD = 2 * Math.PI * d / SR;
        amp = a;
        harm = h;
        int min = AudioTrack.getMinBufferSize(SR, AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_FLOAT);
        track = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build())
                .setAudioFormat(new AudioFormat.Builder()
                        .setSampleRate(SR)
                        .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
                        .build())
                .setTransferMode(AudioTrack.MODE_STREAM)
                .setBufferSizeInBytes(Math.max(min, SR / 2 * 2 * 4))      // half a second in hand
                .build();
        if (track.getState() != AudioTrack.STATE_INITIALIZED) {
            track.release();
            throw new IllegalStateException("audio track not initialized");
        }
        volume(0f);
        fio = new Thread(new Runnable() { @Override public void run() { gerar(); } }, "fn-tom");
        fio.start();
    }

    /** Writes the tone block after block; waits while paused, so the next sample follows the last one. */
    private void gerar() {
        try { android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_AUDIO); } catch (Exception ignored) { }
        final float[] b = new float[BLOCO * 2];
        final double volta = 2 * Math.PI;
        double fe = 0, fd = 0;
        int feito = b.length;                                  // nothing waiting to be written
        while (vivo) {
            synchronized (trava) {
                while (vivo && !tocando) {
                    try { trava.wait(); } catch (InterruptedException ex) { return; }
                }
            }
            if (!vivo) break;
            if (feito >= b.length) {
                for (int i = 0; i < BLOCO; i++) {
                    b[2 * i] = (float) (amp * (Math.sin(fe) + harm * Math.sin(2 * fe + 0.4)));
                    b[2 * i + 1] = (float) (amp * (Math.sin(fd) + harm * Math.sin(2 * fd + 0.4)));
                    fe += passoE;
                    if (fe >= volta) fe -= volta;
                    fd += passoD;
                    if (fd >= volta) fd -= volta;
                }
                feito = 0;
            }
            int w;
            try { w = track.write(b, feito, b.length - feito, AudioTrack.WRITE_BLOCKING); } catch (Exception ex) { w = -1; }
            if (w < 0) {
                Log.w(ForNowPlugin.TAG, "tom parou de escrever (" + w + ")");
                return;
            }
            if (w == 0) {
                try { Thread.sleep(10); } catch (InterruptedException ex) { return; }
            }
            feito += w;                                        // a pause can cut a block short: the rest waits
        }
    }

    void tocar() {
        synchronized (trava) { tocando = true; trava.notifyAll(); }
        try { if (track.getPlayState() != AudioTrack.PLAYSTATE_PLAYING) track.play(); } catch (Exception ex) { Log.w(ForNowPlugin.TAG, "tom play", ex); }
    }

    void pausar() {
        synchronized (trava) { tocando = false; }
        try { track.pause(); } catch (Exception ignored) { }
    }

    boolean tocando() { return tocando; }

    void volume(float v) {
        v = Math.max(0f, Math.min(1f, v));
        if (Math.abs(v - volume) < 0.001f) return;
        volume = v;
        try { track.setVolume(v); } catch (Exception ignored) { }
    }

    void soltar() {
        vivo = false;
        synchronized (trava) { tocando = false; trava.notifyAll(); }
        try { track.pause(); } catch (Exception ignored) { }
        try { track.flush(); } catch (Exception ignored) { }
        try { fio.join(400); } catch (Exception ignored) { }
        try { track.release(); } catch (Exception ignored) { }
    }
}
