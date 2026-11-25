package com.wsqm1990.fornow;

import android.Manifest;
import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.provider.AlarmClock;
import android.provider.Settings;
import android.util.Log;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityManager;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/** Everything the page asks of the phone: sessions, voice, the nap alarm, shortcuts, calls, updates. */
@CapacitorPlugin(
        name = "ForNow",
        permissions = {@Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})}
)
public class ForNowPlugin extends Plugin {
    static final String TAG = "ForNow";
    static final String BUNDLE_PREFS = "fn_bundle";
    private static volatile ForNowPlugin current;
    private static volatile String acaoPendente = null;
    private static volatile long acaoEm = 0;
    /** an action not picked up within this time (the page wasn't there) is dropped, never run later */
    private static final long ACAO_VALIDA_MS = 120000;

    @Override
    public void load() {
        current = this;
        Log.i(TAG, "plugin load " + Integer.toHexString(System.identityHashCode(this)));
    }

    /**
     * Called from any thread (services). Never kept for later: Capacitor drops a page's listeners
     * whenever a page starts loading, so a kept event could replay long after it happened. The page
     * asks for the current state itself when it starts and whenever it comes back (pull), and
     * these events only make it react sooner.
     */
    static void emit(String evento, JSONObject data) {
        ForNowPlugin p = current;
        if (p == null || data == null) return;
        try {
            p.notifyListeners(evento, new JSObject(data.toString()), false);
        } catch (Exception e) {
            Log.w(TAG, "emit failed", e);
        }
    }

    /** Which of our events the page is listening to right now (the page adds back any that went missing). */
    @PluginMethod
    public void ouvintes(PluginCall call) {
        JSObject r = new JSObject();
        r.put("guia", hasListeners("guia"));
        r.put("alarme", hasListeners("alarme"));
        r.put("launch", hasListeners("launch"));
        call.resolve(r);
    }

    // ------------------------------------------------------------ what opened the app

    static void lembrarAcao(Intent i) {
        if (i == null) return;
        String a = null;
        Uri d = i.getData();
        if (d != null && "fornow".equals(d.getScheme())) a = d.getHost();
        if (a == null) a = i.getStringExtra("fn_acao");
        if (a != null && a.length() > 0) {
            synchronized (ForNowPlugin.class) { acaoPendente = a; acaoEm = SystemClock.elapsedRealtime(); }
            Log.i(TAG, "launch action " + a);
        }
    }

    /** Pokes the page; the page then takes the action with launchAction (only once). */
    static void avisarAcao() {
        ForNowPlugin p = current;
        if (p == null || acaoPendente == null) return;
        JSObject o = new JSObject();
        o.put("pendente", true);
        try { p.notifyListeners("launch", o, false); } catch (Exception e) { Log.w(TAG, "launch poke failed", e); }
    }

    @PluginMethod
    public void launchAction(PluginCall call) {
        String a;
        synchronized (ForNowPlugin.class) {
            a = acaoPendente;
            boolean velha = a != null && SystemClock.elapsedRealtime() - acaoEm > ACAO_VALIDA_MS;
            acaoPendente = null;
            if (velha) { Log.i(TAG, "launch action " + a + " expired"); a = null; }
        }
        JSObject r = new JSObject();
        r.put("acao", a == null ? "" : a);
        call.resolve(r);
    }

    // ------------------------------------------------------------ sessions

    @PluginMethod
    public void guiaStart(PluginCall call) {
        Context ctx = getContext();
        Intent i = new Intent(ctx, GuiaService.class).setAction(GuiaService.ACTION_START).putExtra(GuiaService.EXTRA_PLANO, call.getData().toString());
        try {
            ContextCompat.startForegroundService(ctx, i);
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "guia start failed", e);
            call.reject("start_failed");
        }
    }

    @PluginMethod
    public void guiaUpdate(PluginCall call) {
        final String json = call.getData().toString();
        final GuiaService s = GuiaService.instance;
        if (s != null) s.post(new Runnable() { @Override public void run() { s.aplicar(json); } });
        call.resolve();
    }

    @PluginMethod
    public void guiaStop(PluginCall call) {
        final String id = call.getString("id", "");
        final GuiaService s = GuiaService.instance;
        if (s != null) s.post(new Runnable() { @Override public void run() { s.pararPeloApp(id); } });
        call.resolve();
    }

    @PluginMethod
    public void guiaState(PluginCall call) {
        try {
            call.resolve(new JSObject(GuiaService.lerEstado(getContext()).toString()));
        } catch (Exception e) {
            call.resolve(new JSObject());
        }
    }

    // ------------------------------------------------------------ voice

    @PluginMethod
    public void falar(PluginCall call) {
        Double rate = call.getDouble("rate", 0.9);
        Fala.get(getContext()).dizer(call.getString("texto", ""), call.getString("lang", "en-US"), rate == null ? 0.9f : rate.floatValue(), 1f);
        call.resolve();
    }

    @PluginMethod
    public void vozStatus(PluginCall call) {
        Fala.get(getContext()).status(call.getString("lang", "en-US"), call);
    }

    // ------------------------------------------------------------ nap alarm

    @PluginMethod
    public void alarmeStatus(PluginCall call) {
        call.resolve(Despertador.status(getContext(), notificationsOn()));
    }

    @PluginMethod
    public void alarmePermitir(PluginCall call) {
        Despertador.pedirPermissao(getContext());
        call.resolve();
    }

    @PluginMethod
    public void alarmeAgendar(PluginCall call) {
        Long at = call.getLong("at", 0L);
        call.resolve(Despertador.agendar(getContext(), call.getString("tipo", "cochilo"), at == null ? 0L : at));
    }

    @PluginMethod
    public void alarmeCancelar(PluginCall call) {
        Despertador.cancelar(getContext(), call.getString("tipo", "cochilo"));
        call.resolve();
    }

    @PluginMethod
    public void alarmeDesligar(PluginCall call) {
        AlarmeService.desligar(getContext());
        call.resolve();
    }

    @PluginMethod
    public void alarmeLog(PluginCall call) {
        JSObject r = new JSObject();
        r.put("itens", Despertador.log(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void alarmeLimparLog(PluginCall call) {
        Despertador.limparLog(getContext());
        call.resolve();
    }

    @PluginMethod
    public void proximoAlarme(PluginCall call) {
        JSObject r = new JSObject();
        r.put("at", Despertador.proximo(getContext()));
        call.resolve(r);
    }

    /** Plan B: the phone's own Clock app, with the time filled in. The person confirms it there. */
    @PluginMethod
    public void abrirRelogio(PluginCall call) {
        Integer h = call.getInt("hora", 0), m = call.getInt("minuto", 0);
        int hora = h == null ? 0 : h, minuto = m == null ? 0 : m;
        Intent i = new Intent(AlarmClock.ACTION_SET_ALARM);
        i.putExtra(AlarmClock.EXTRA_HOUR, hora);
        i.putExtra(AlarmClock.EXTRA_MINUTES, minuto);
        i.putExtra(AlarmClock.EXTRA_MESSAGE, call.getString("mensagem", "For Now"));
        i.putExtra(AlarmClock.EXTRA_SKIP_UI, false);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(i);
            JSObject r = new JSObject();
            r.put("ok", true);
            call.resolve(r);
        } catch (Exception e) {
            Log.w(TAG, "clock app", e);
            call.reject("no_clock");
        }
    }

    // ------------------------------------------------------------ permissions and phone settings

    private boolean notificationsOn() {
        boolean enabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        if (Build.VERSION.SDK_INT < 33) return enabled;
        return enabled && getPermissionState("notifications") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void notifStatus(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", notificationsOn());
        call.resolve(r);
    }

    @PluginMethod
    public void askNotif(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notifCallback");
        } else {
            notifCallback(call);
        }
    }

    @PermissionCallback
    private void notifCallback(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", notificationsOn());
        call.resolve(r);
    }

    @PluginMethod
    public void openNotifSettings(PluginCall call) {
        Context ctx = getContext();
        try {
            Intent i;
            if (Build.VERSION.SDK_INT >= 26) {
                i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                i.putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
            } else {
                i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.getPackageName()));
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        } catch (Exception e) {
            abrirDetalhes(ctx);
        }
        call.resolve();
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        abrirDetalhes(getContext());
        call.resolve();
    }

    @PluginMethod
    public void abrirTelaCheia(PluginCall call) {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                Intent i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + ctx.getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
                call.resolve();
                return;
            } catch (Exception ignored) { }
        }
        abrirDetalhes(ctx);
        call.resolve();
    }

    /** Xiaomi / Poco: autostart and "other permissions" live in their own settings screens. */
    @PluginMethod
    public void abrirXiaomi(PluginCall call) {
        Context ctx = getContext();
        String tipo = call.getString("tipo", "autostart");
        Intent i = new Intent();
        if ("permissoes".equals(tipo)) {
            i.setAction("miui.intent.action.APP_PERM_EDITOR");
            i.setClassName("com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity");
            i.putExtra("extra_pkgname", ctx.getPackageName());
        } else {
            i.setComponent(new ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"));
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            ctx.startActivity(i);
        } catch (Exception e) {
            abrirDetalhes(ctx);
        }
        call.resolve();
    }

    private static void abrirDetalhes(Context ctx) {
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        } catch (Exception ignored) { }
    }

    // ------------------------------------------------------------ screen, calls, links, sharing

    /** Low brightness inside the app only (night screens); -1 gives it back to the phone. */
    @PluginMethod
    public void brilho(PluginCall call) {
        Double v = call.getDouble("nivel", -1.0);
        final float n = v == null ? -1f : v.floatValue();
        final Activity a = getActivity();
        if (a != null) {
            a.runOnUiThread(new Runnable() {
                @Override public void run() {
                    WindowManager.LayoutParams lp = a.getWindow().getAttributes();
                    lp.screenBrightness = n < 0 ? WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE : Math.max(0.01f, Math.min(1f, n));
                    a.getWindow().setAttributes(lp);
                }
            });
        }
        call.resolve();
    }

    /** Opens the dialer with the number. Never calls by itself. */
    @PluginMethod
    public void discar(PluginCall call) {
        String n = call.getString("numero", "").replaceAll("[^0-9+]", "");
        abrirIntent(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(n))), call);
    }

    @PluginMethod
    public void mensagem(PluginCall call) {
        String n = call.getString("numero", "").replaceAll("[^0-9+]", "");
        abrirIntent(new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(n))), call);
    }

    @PluginMethod
    public void abrirLink(PluginCall call) {
        String url = call.getString("url", "");
        if (!url.startsWith("https://")) { call.reject("bad_url"); return; }
        abrirIntent(new Intent(Intent.ACTION_VIEW, Uri.parse(url)), call);
    }

    private void abrirIntent(Intent i, PluginCall call) {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("cannot_open");
        }
    }

    @PluginMethod
    public void compartilharTexto(PluginCall call) {
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, call.getString("texto", ""));
        Intent chooser = Intent.createChooser(send, call.getString("titulo", "For Now"));
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            call.reject("share_failed");
        }
    }

    @PluginMethod
    public void minimizar(PluginCall call) {
        final Activity a = getActivity();
        if (a != null) a.runOnUiThread(new Runnable() { @Override public void run() { a.moveTaskToBack(true); } });
        call.resolve();
    }

    /** Texts for the widget, tile, shortcuts and alarm screen, in the app's language. */
    @PluginMethod
    public void setLabels(PluginCall call) {
        Context ctx = getContext();
        Rotulos.salvar(ctx, call.getData());
        Rotulos.atualizarAtalhos(ctx);
        Rotulos.atualizarWidgets(ctx);
        Rotulos.atualizarBloco(ctx);
        call.resolve();
    }

    // ------------------------------------------------------------ app info and automatic updates

    @SuppressWarnings("deprecation")
    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = new JSObject();
        Context ctx = getContext();
        try {
            PackageInfo pi = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            r.put("versionName", pi.versionName);
            r.put("versionCode", Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : (long) pi.versionCode);
        } catch (Exception ignored) { }
        String inst = null;
        try {
            PackageManager pm = ctx.getPackageManager();
            if (Build.VERSION.SDK_INT >= 30) inst = pm.getInstallSourceInfo(ctx.getPackageName()).getInstallingPackageName();
            else inst = pm.getInstallerPackageName(ctx.getPackageName());
        } catch (Exception ignored) { }
        r.put("installer", inst == null ? "" : inst);
        // "shell" goes up by hand only for old installs; "shellId" is the fingerprint of the native
        // files this APK was built from (the build fills it in). A web update made for other native
        // files asks for the new APK instead of loading into this one.
        r.put("shell", 2);
        String shellId = "";
        try { shellId = ctx.getString(R.string.fn_shell_id); } catch (Exception ignored) { }
        r.put("shellId", shellId);
        r.put("sdk", Build.VERSION.SDK_INT);
        r.put("maker", Build.MANUFACTURER);
        r.put("model", Build.MODEL);
        boolean talkback = false;
        try {
            AccessibilityManager am = (AccessibilityManager) ctx.getSystemService(Context.ACCESSIBILITY_SERVICE);
            talkback = am != null && am.isEnabled() && am.isTouchExplorationEnabled();
        } catch (Exception ignored) { }
        r.put("talkback", talkback);
        call.resolve(r);
    }

    /** Downloads a web bundle (a zip of index.html and friends), checks it and unpacks it. */
    @PluginMethod
    public void fetchBundle(final PluginCall call) {
        final String url = call.getString("url", "");
        final String build = call.getString("build", "").replaceAll("[^0-9A-Za-z._-]", "");
        final String sha = call.getString("sha256", "");
        if (url.length() == 0 || build.length() == 0) { call.reject("bad_args"); return; }
        new Thread(new Runnable() {
            @Override public void run() {
                File root = new File(getContext().getFilesDir(), "bundles");
                File dest = new File(root, build);
                File zip = new File(getContext().getCacheDir(), "bundle-" + build + ".zip");
                try {
                    if (new File(dest, "index.html").exists()) {
                        JSObject r = new JSObject();
                        r.put("path", dest.getAbsolutePath());
                        call.resolve(r);
                        return;
                    }
                    download(url, zip);
                    if (sha.length() > 0 && !sha.equalsIgnoreCase(sha256(zip))) throw new IOException("checksum");
                    File tmp = new File(root, build + ".tmp");
                    deleteTree(tmp);
                    unzip(zip, tmp);
                    if (!new File(tmp, "index.html").exists()) throw new IOException("no index.html");
                    deleteTree(dest);
                    if (!tmp.renameTo(dest)) throw new IOException("rename");
                    JSObject r = new JSObject();
                    r.put("path", dest.getAbsolutePath());
                    call.resolve(r);
                    Log.i(TAG, "bundle ready " + build);
                } catch (Exception e) {
                    Log.w(TAG, "bundle failed", e);
                    call.reject("bundle_failed: " + e.getMessage());
                } finally {
                    if (zip.exists() && !zip.delete()) Log.w(TAG, "zip not deleted");
                }
            }
        }, "fn-bundle").start();
    }

    /** A small text file from the internet (the update check), read outside the page. */
    @PluginMethod
    public void fetchText(final PluginCall call) {
        final String url = call.getString("url", "");
        if (!url.startsWith("https://")) { call.reject("bad_args"); return; }
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(20000);
                    c.setUseCaches(false);
                    c.setInstanceFollowRedirects(true);
                    try {
                        int code = c.getResponseCode();
                        if (code != 200) throw new IOException("HTTP " + code);
                        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                        try (InputStream in = c.getInputStream()) {
                            byte[] buf = new byte[8192];
                            int n;
                            while ((n = in.read(buf)) > 0 && out.size() < 1000000) out.write(buf, 0, n);
                        }
                        JSObject r = new JSObject();
                        r.put("text", new String(out.toByteArray(), StandardCharsets.UTF_8));
                        call.resolve(r);
                    } finally {
                        c.disconnect();
                    }
                } catch (Exception e) {
                    call.reject("fetch_failed: " + e.getMessage());
                }
            }
        }, "fn-fetch").start();
    }

    @PluginMethod
    public void cleanBundles(PluginCall call) {
        JSONArray keep = call.getData().optJSONArray("keep");
        File root = new File(getContext().getFilesDir(), "bundles");
        File[] all = root.listFiles();
        if (all != null) for (File f : all) {
            boolean k = false;
            if (keep != null) for (int i = 0; i < keep.length(); i++) if (f.getName().equals(keep.optString(i, ""))) k = true;
            if (!k) deleteTree(f);
        }
        call.resolve();
    }

    /** Keeps a downloaded web bundle as the app's page. It is dropped when a new APK is installed. */
    @PluginMethod
    public void keepBundle(PluginCall call) {
        String path = call.getString("path", "");
        if (path.length() == 0 || !new File(path, "index.html").exists()) { call.reject("no_bundle"); return; }
        getContext().getSharedPreferences(BUNDLE_PREFS, Context.MODE_PRIVATE).edit()
                .putString("path", path).putLong("versionCode", versionCode(getContext())).apply();
        call.resolve();
    }

    @PluginMethod
    public void forgetBundle(PluginCall call) {
        getContext().getSharedPreferences(BUNDLE_PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        call.resolve();
    }

    @SuppressWarnings("deprecation")
    static long versionCode(Context ctx) {
        try {
            PackageInfo pi = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            return Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : (long) pi.versionCode;
        } catch (Exception e) {
            return -1;
        }
    }

    /** Called by MainActivity at start: open the kept web bundle instead of the one in the APK. */
    static void applySavedBundle(Context ctx, Bridge bridge) {
        try {
            SharedPreferences p = ctx.getSharedPreferences(BUNDLE_PREFS, Context.MODE_PRIVATE);
            String path = p.getString("path", null);
            if (path == null || bridge == null) return;
            if (p.getLong("versionCode", -2) != versionCode(ctx) || !new File(path, "index.html").exists()) {
                p.edit().clear().apply();
                return;
            }
            if (path.equals(bridge.getServerBasePath())) return;
            bridge.setServerBasePath(path);
            Log.i(TAG, "using kept bundle " + path);
        } catch (Exception e) {
            Log.w(TAG, "kept bundle failed", e);
        }
    }

    /** Starts the page again from the kept bundle (used when a new bundle fails to start). */
    @PluginMethod
    public void reloadApp(PluginCall call) {
        final Activity a = getActivity();
        call.resolve();
        if (a != null) a.runOnUiThread(new Runnable() { @Override public void run() { a.recreate(); } });
    }

    private static void download(String url, File dest) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setUseCaches(false);
        c.setInstanceFollowRedirects(true);
        try {
            int code = c.getResponseCode();
            if (code != 200) throw new IOException("HTTP " + code);
            try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(dest)) {
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            }
        } finally {
            c.disconnect();
        }
    }

    private static String sha256(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(f)) {
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
        }
        StringBuilder sb = new StringBuilder();
        for (byte b : md.digest()) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    private static void unzip(File zip, File dir) throws IOException {
        String base = dir.getCanonicalPath() + File.separator;
        if (!dir.exists() && !dir.mkdirs()) throw new IOException("mkdir");
        try (ZipInputStream zin = new ZipInputStream(new FileInputStream(zip))) {
            ZipEntry e;
            byte[] buf = new byte[16384];
            while ((e = zin.getNextEntry()) != null) {
                File out = new File(dir, e.getName());
                if (!out.getCanonicalPath().startsWith(base)) throw new IOException("bad entry");
                if (e.isDirectory()) { if (!out.exists() && !out.mkdirs()) throw new IOException("mkdir"); continue; }
                File parent = out.getParentFile();
                if (parent != null && !parent.exists() && !parent.mkdirs()) throw new IOException("mkdir");
                try (OutputStream os = new FileOutputStream(out)) {
                    int n;
                    while ((n = zin.read(buf)) > 0) os.write(buf, 0, n);
                }
            }
        }
    }

    private static void deleteTree(File f) {
        if (f == null || !f.exists()) return;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteTree(k);
        if (!f.delete()) Log.w(TAG, "not deleted " + f.getName());
    }
}
