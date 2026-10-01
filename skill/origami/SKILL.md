---
name: origami
description: Convert a website URL into native apps for Android, iOS, Windows, macOS and/or Linux, with custom icon and splash screen, signed release builds, and optional upload to Google Play / App Store (TestFlight). Use when the user asks to turn, wrap, convert or package a website/web app into a mobile or desktop app, an APK/AAB, an IPA, an .exe/.msi, a .dmg or a Linux package, or to publish such an app to the stores.
---

# Origami

Wraps a live website in a native shell: Pake/Tauri for desktop, Capacitor for mobile. The CLI lives in the Origami repo at `bin/origami.mjs`. Ask the user for its path if it's not the current project.

## Steps

1. **Collect inputs.** Ask with AskUserQuestion (targets is multi-select):
   - Website URL (public `https://`) and app name (letters, numbers and spaces, max 30)
   - Targets: `android`, `ios`, `windows`, `macos`, `linux`
   - Optional:
     - icon URL (1024×1024 PNG is best; the site favicon is used otherwise)
     - app ID (`com.company.app`; required for publishing and permanent once published)
     - version (`1.0.0`)
     - color (`#RRGGBB`, used for the icon background, splash screen and offline page)
   - Goal:
     - **test builds** (default)
     - **signed builds** → `--sign`
     - **publish to stores** → `--publish`, which needs `--remote`
2. **Pick local or remote.**
   - Local builds the targets the host machine supports: its own desktop OS, android, and ios only on macOS.
   - Use `--remote` (GitHub Actions) for other OSes and always for `--publish`.
3. **Check prerequisites** before running:
   - Local desktop: `cargo --version` (Rust). Local android: JDK 21 + `ANDROID_HOME`. Local ios: `xcodebuild -version`.
   - Remote: `gh auth status`, plus a repo with `.github/workflows/build.yml` (`--repo owner/repo` or `ORIGAMI_REPO`).
   - Signing and publishing need the secrets in the README section "Store publishing":
     - Android: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, plus `PLAY_SERVICE_ACCOUNT_JSON` for publishing
     - iOS: `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`
     - Check them with `gh secret list -R <repo>`. Never ask the user to paste secret values into the chat; tell them to run `gh secret set NAME -R <repo>` themselves.
   If something is missing, give the exact setup step instead of starting a build that will fail.
4. **Run** (5–20 min; use a long timeout or run it in the background):
   `node <repo>/bin/origami.mjs "<url>" --name "<name>" --targets <a,b> [--icon URL] [--app-id ID] [--app-version X.Y.Z] [--color #hex] [--sign | --publish] [--remote]`
5. **Report** the files in `out/` and what's next:
   - Test builds: the APK is debug-signed, the iOS output is an unsigned Xcode project, and the .dmg is unsigned.
   - Publish: Android goes to the Play **internal track as a draft**. Google requires the very first AAB of a new app to be uploaded by hand in Play Console. iOS appears in **TestFlight** after processing.
   - Warn the user: Apple often rejects apps that only show a website (guideline 4.2, "minimum functionality"). Google Play is more lenient.

## Not supported
Converting a finished app binary (an .exe, .apk or .ipa) to another OS can't be done; only emulation exists. An app → website conversion needs the app's source code. Desktop code signing and the Microsoft Store / Mac App Store aren't automated yet.
