#!/usr/bin/env bash
# Installs the debug build on the emulator and walks through the app like a person would
# (native/ci/e2e.mjs drives the page through Chrome DevTools). Screenshots and logs go to $1.
set -u
OUT="${1:-test-out}"
mkdir -p "$OUT"
PKG=com.wsqm1990.fornow
APK=$(ls apk/*.apk | head -n 1)

adb wait-for-device
adb shell getprop ro.build.version.release > "$OUT/android-version.txt"
adb shell dumpsys package com.google.android.webview | grep -m1 versionName > "$OUT/webview-version.txt" || true
adb shell cmd package query-services -a android.intent.action.TTS_SERVICE > "$OUT/tts-engines.txt" 2>&1 || true
# no lock screen PIN on the emulator: the power key turns the screen off and on
adb shell settings put system screen_off_timeout 600000 || true

if ! adb install -r "$APK" > "$OUT/install.txt" 2>&1; then cat "$OUT/install.txt"; exit 1; fi
# notifications on, as after the first nap; exact alarms stay off until the test grants them
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS 2>/dev/null || true
adb logcat -c

# A copy of this build with a higher number, used to test the automatic update.
rm -rf upd && mkdir upd && (cd upd && unzip -q ../rel/web.zip)
N=$(grep -o 'window.FN_BUILD=[0-9]*' upd/index.html | head -n 1 | cut -d= -f2)
UP=$((N + 100000))
sed -i "s/window.FN_BUILD=$N;/window.FN_BUILD=$UP;/" upd/index.html
(cd upd && zip -qr ../upd.zip .)
echo "$UP" > "$OUT/update-build.txt"

adb shell am start -W -n $PKG/.MainActivity > "$OUT/start.txt" 2>&1
sleep 6

SHELL_ID=$(grep -o '"shellId":"[0-9a-z]*"' rel/version.json | cut -d'"' -f4)
node native/ci/e2e.mjs "$OUT" "$PKG" "$UP" "$SHELL_ID"
RC=$?

adb logcat -d > "$OUT/logcat-last.txt" 2>&1
cat "$OUT"/logcat-part*.txt "$OUT/logcat-last.txt" > "$OUT/logcat-all.txt" 2>/dev/null || true
grep -E "ForNow|Capacitor|chromium|AndroidRuntime|fornow|TextToSpeech|tts" "$OUT/logcat-all.txt" > "$OUT/logcat-app.txt" || true
adb shell dumpsys notification --noredact > "$OUT/notifications.txt" 2>&1 || true
adb shell dumpsys alarm > "$OUT/alarms.txt" 2>&1 || true
exit $RC
