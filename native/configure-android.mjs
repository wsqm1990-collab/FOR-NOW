// Runs in CI after `npx cap add android`: adds our native code, resources, permissions,
// components, signing-free release build and the version to the generated Android project.
// Prints what it changed, so the build log shows the final manifest.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(here, 'android', 'app');
const main = path.join(app, 'src', 'main');
const res = path.join(main, 'res');
const pkgDir = path.join(main, 'java', 'com', 'wsqm1990', 'fornow');
const build = Number(process.env.BUILD_NUMBER || 1);

const read = f => fs.readFileSync(f, 'utf8');
const write = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const must = (ok, what) => { if (!ok) { console.error('configure-android: could not ' + what); process.exit(1); } };
function copyTree(from, to) {
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyTree(a, b); else { fs.mkdirSync(to, { recursive: true }); fs.copyFileSync(a, b); }
  }
}

// 0. The Java package must be the app id, or the code can't see R (the app's resources).
const appId = JSON.parse(read(path.join(here, 'capacitor.config.json'))).appId;
must(appId === 'com.wsqm1990.fornow', `use appId com.wsqm1990.fornow in capacitor.config.json (found ${appId})`);
must(/namespace\s*=?\s*["']com\.wsqm1990\.fornow["']/.test(read(path.join(app, 'build.gradle'))), 'find namespace com.wsqm1990.fornow in app/build.gradle');

// 1. Java: plugin, services, receivers, alarm screen, tile and widget (MainActivity replaces Capacitor's).
fs.mkdirSync(pkgDir, { recursive: true });
for (const f of fs.readdirSync(path.join(here, 'android-src', 'java'))) fs.copyFileSync(path.join(here, 'android-src', 'java', f), path.join(pkgDir, f));
console.log('java:', fs.readdirSync(pkgDir).join(', '));

// 2. Resources. The template's splash PNGs go away so our splash.xml is the only splash.
for (const d of fs.readdirSync(res)) {
  const f = path.join(res, d, 'splash.png');
  if (d.startsWith('drawable') && fs.existsSync(f)) fs.rmSync(f);
}
copyTree(path.join(here, 'android-src', 'res'), res);

// 3. Manifest.
const mf = path.join(main, 'AndroidManifest.xml');
let m = read(mf);
const perms = ['FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_MEDIA_PLAYBACK', 'POST_NOTIFICATIONS', 'WAKE_LOCK', 'VIBRATE',
  'SCHEDULE_EXACT_ALARM', 'RECEIVE_BOOT_COMPLETED', 'USE_FULL_SCREEN_INTENT']
  .filter(p => !m.includes(`android.permission.${p}"`))
  .map(p => `    <uses-permission android:name="android.permission.${p}" />`);
perms.push('    <uses-permission android:name="com.android.alarm.permission.SET_ALARM" />');
const queries = `    <queries>
        <intent><action android:name="android.intent.action.TTS_SERVICE" /></intent>
        <intent><action android:name="android.intent.action.SET_ALARM" /></intent>
        <intent><action android:name="android.intent.action.DIAL" /></intent>
        <intent><action android:name="android.intent.action.SENDTO" /><data android:scheme="smsto" /></intent>
        <intent><action android:name="android.intent.action.VIEW" /><data android:scheme="https" /></intent>
    </queries>`;
must(m.includes('<application'), 'find <application> in the manifest');
m = m.replace('<application', `${perms.join('\n')}\n${queries}\n\n    <application`);
/* history and answers stay on this phone: no Google backup */
if (/android:allowBackup="true"/.test(m)) m = m.replace(/android:allowBackup="true"/, 'android:allowBackup="false"');
else m = m.replace('<application', '<application\n        android:allowBackup="false"');
m = m.replace(/\s*android:fullBackupContent="[^"]*"/, '').replace(/\s*android:dataExtractionRules="[^"]*"/, '');
must(m.includes('android:allowBackup="false"'), 'turn off backup');
const componentes = `
        <service android:name=".GuiaService" android:exported="false" android:foregroundServiceType="mediaPlayback" />
        <service android:name=".AlarmeService" android:exported="false" android:foregroundServiceType="mediaPlayback" />
        <receiver android:name=".AlarmeReceiver" android:exported="false" />
        <receiver android:name=".BootReceiver" android:enabled="false" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
                <action android:name="android.intent.action.QUICKBOOT_POWERON" />
            </intent-filter>
        </receiver>
        <activity
            android:name=".AlarmeActivity"
            android:excludeFromRecents="true"
            android:exported="false"
            android:launchMode="singleInstance"
            android:screenOrientation="portrait"
            android:showWhenLocked="true"
            android:taskAffinity=""
            android:theme="@android:style/Theme.DeviceDefault.NoActionBar"
            android:turnScreenOn="true" />
        <service
            android:name=".PicoTile"
            android:exported="true"
            android:icon="@drawable/ic_fn_tile"
            android:label="@string/fn_tile"
            android:permission="android.permission.BIND_QUICK_SETTINGS_TILE">
            <intent-filter><action android:name="android.service.quicksettings.action.QS_TILE" /></intent-filter>
        </service>
        <receiver android:name=".PicoWidget" android:exported="false" android:label="@string/fn_widget_padrao">
            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/fn_widget_info" />
        </receiver>
    </application>`;
must(m.includes('</application>'), 'find </application>');
m = m.replace('</application>', componentes.trimStart().replace(/^/, '    '));
const ACT_RE = /(<activity\b[^>]*android:name="\.?MainActivity")/;
must(ACT_RE.test(m), 'find MainActivity');
if (!m.includes('windowSoftInputMode')) m = m.replace(ACT_RE, '$1\n            android:windowSoftInputMode="adjustResize"');
/* made for the phone held upright */
if (!/MainActivity"[^>]*screenOrientation/.test(m)) m = m.replace(ACT_RE, '$1\n            android:screenOrientation="portrait"');
write(mf, m);
console.log('AndroidManifest.xml:\n' + m);

// 4. Gradle: version from the build number, lint never stops the build.
const gf = ['build.gradle', 'build.gradle.kts'].map(f => path.join(app, f)).find(f => fs.existsSync(f));
must(gf && gf.endsWith('build.gradle'), 'find a Groovy app/build.gradle');
let g = read(gf);
g = g.replace(/versionCode\s+\d+/, `versionCode ${build}`).replace(/versionName\s+"[^"]*"/, `versionName "0.1.${build}"`);
must(g.includes(`versionCode ${build}`), 'set versionCode');
must(/\n\s*buildTypes\s*\{/.test(g), 'find buildTypes');
g = g.replace(/(\n)(\s*buildTypes\s*\{)/, `$1    lint {\n        checkReleaseBuilds false\n        abortOnError false\n    }\n$2`);
write(gf, g);
console.log('app/build.gradle:\n' + g);

// 5. Themes: follow the phone's light/dark mode, light splash.
const sf = path.join(res, 'values', 'styles.xml');
if (fs.existsSync(sf)) {
  let s = read(sf);
  s = s.replace(/Theme\.AppCompat\.Light\.DarkActionBar/g, 'Theme.AppCompat.DayNight.DarkActionBar')
    .replace(/Theme\.AppCompat\.Light\.NoActionBar/g, 'Theme.AppCompat.DayNight.NoActionBar')
    .replace(/"Theme\.AppCompat\.NoActionBar"/g, '"Theme.AppCompat.DayNight.NoActionBar"');
  s = s.replace(/(<style name="AppTheme\.NoActionBarLaunch"[^>]*>)/, '$1\n        <item name="windowSplashScreenBackground">@color/fn_splash_bg</item>');
  write(sf, s);
  console.log('styles.xml:\n' + s);
}

for (const f of ['variables.gradle', 'build.gradle'].map(x => path.join(here, 'android', x))) if (fs.existsSync(f)) console.log(path.basename(f) + ':\n' + read(f));
console.log('configure-android: done for build', build);
