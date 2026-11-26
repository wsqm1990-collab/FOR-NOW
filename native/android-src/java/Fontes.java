package com.wsqm1990.fornow;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.MediaPlayer;
import android.util.Log;

import java.io.File;

/**
 * Where the app's audio comes from. "midia/..." files ship inside the APK (voices, music, nature
 * sounds). A plain name ("chuva") is one of the page's own sounds: from a downloaded update of the
 * page if there is one, otherwise from the page that came with the app.
 */
final class Fontes {
    private Fontes() { }

    static boolean abrir(Context c, MediaPlayer mp, String nome) {
        if (nome == null || nome.length() == 0) return false;
        if (nome.startsWith("midia/")) {
            try (AssetFileDescriptor fd = c.getAssets().openFd(nome)) {
                mp.setDataSource(fd.getFileDescriptor(), fd.getStartOffset(), fd.getLength());
                return true;
            } catch (Exception e) {
                Log.w(ForNowPlugin.TAG, "asset " + nome, e);
                return false;
            }
        }
        try {
            String base = c.getSharedPreferences(ForNowPlugin.BUNDLE_PREFS, Context.MODE_PRIVATE).getString("path", null);
            if (base != null) {
                File f = new File(base, "sons/" + nome + ".ogg");
                if (f.exists()) { mp.setDataSource(f.getAbsolutePath()); return true; }
            }
        } catch (Exception ignored) { }
        try (AssetFileDescriptor fd = c.getAssets().openFd("public/sons/" + nome + ".ogg")) {
            mp.setDataSource(fd.getFileDescriptor(), fd.getStartOffset(), fd.getLength());
            return true;
        } catch (Exception e) {
            Log.w(ForNowPlugin.TAG, "asset sons/" + nome, e);
            return false;
        }
    }

    static boolean existe(Context c, String nome) {
        if (nome == null || !nome.startsWith("midia/")) return false;
        try (AssetFileDescriptor fd = c.getAssets().openFd(nome)) {
            return fd.getLength() > 0;
        } catch (Exception e) {
            return false;
        }
    }
}
