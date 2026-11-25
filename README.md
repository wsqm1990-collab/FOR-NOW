# For Now

A personal Android app for the moments anxiety gets in the way: one-tap help in a spike, a few
quiet minutes, naps with a verified alarm and calmer nights. English first, with Português and
Español in Settings. Works offline and keeps your data on the phone.

**For Now is a self-care tool, not a treatment.** It does not diagnose anything and cannot tell
whether a symptom is anxiety. In Brazil: CVV 188 (emotional support, 24 h, free) and SAMU 192
(urgent care) are one tap away inside the app.

## Install on the phone (once)

Open **Releases** on the phone, tap **ForNow.apk** in the latest release and open the download.
After that the app updates itself: new versions arrive when you leave the app with nothing in
progress. Never uninstall to update — that would erase your history.

## What is in version 0.1

- **It's hard right now** — one tap, one sentence at a time, voice or text only. *Switch* changes
  the technique at once, with no menu. It keeps going with the screen locked.
- **A little peace** — 5 minutes letting the body go, or 10 minutes with a sound. The voice leaves
  early; the end is silent.
- **Nap** — the app only says the alarm is set after Android confirms it. Plan B: the phone's own
  Clock app, or rest without an alarm. A 1-minute alarm test lives in Diagnostics.
- **Awake in the night** — dark, dim, no clock and no questions.
- **I want support from a person** — your trusted contact, CVV 188, SAMU 192, when to go to the UBS.
- **History and Review** — honest counts: no answer never counts as "didn't help"; suggestions show
  the real numbers and change nothing by themselves.
- Widget, Quick Settings tile and icon shortcuts that open the session straight away.

Each exercise has a "Why this exercise?" card with its source, what was adapted and its limits.

## How it is built

- `web/src/` — the app (plain HTML, CSS and JavaScript). `node tools/build.mjs` joins it into
  `web/www/index.html`. `node tools/verificar-textos.mjs` checks that every text exists in the
  three languages and that no forbidden phrase slipped in ("you're safe", "calm down", cure claims).
- `web/sons/` — background sounds made by `tools/sons.py` (no third-party recordings).
- `native/` — the Android shell (Capacitor 8). Our parts are `native/android-src/` (sessions with
  text-to-speech, the nap alarm, alarm screen, tile, widget, updates) and
  `native/configure-android.mjs`, which adds them to the project generated in CI.
- `.github/workflows/android.yml` — on every push to `main`: build, run the app on an Android
  emulator (`native/ci/`), and if the checks pass publish a release with `ForNow.apk`, `web.zip`
  (the automatic update) and `version.json`. Logs and screenshots go to the `ci-results` branch.
- Signing: every build derives the signing key from the `FN_KEY_PASS` repository secret
  (`native/ci/signing-key.py`). Keep that secret as it is: it is what lets a new APK install over
  the old one.
- Test locally: `node tools/build.mjs && python3 test/run-local.py . test/shots`.

## Privacy

History, answers, settings and the trusted contact stay on the phone, outside Google's backup. The
app uses the internet only to look for its own updates on GitHub. Notifications only say "For Now".
