#!/usr/bin/env node
// Builds one target into ./out. Used by CI, the CLI and local testing.
//   node scripts/build.mjs --target android --url https://example.com --name Demo
//     [--icon URL] [--app-id com.me.demo] [--app-version 1.2.0] [--color #112233] [--release none|sign|store]
// Signing/publishing reads credentials from env vars (see README "Store publishing").
import { execFileSync, execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { normalize, slug, validate } from './validate.mjs'

const HOST = { win32: 'windows', darwin: 'macos', linux: 'linux' }[process.platform]

/** Targets this machine can build without CI. */
export const canBuildLocally = target => target === HOST || target === 'android' || (target === 'ios' && HOST === 'macos')

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, CI: 'true' } })
const q = s => JSON.stringify(s) // shell-quote; inputs are validated to safe characters

function need(cmd, hint) {
  try {
    execSync(cmd, { stdio: 'ignore' })
  } catch {
    throw new Error(`Missing prerequisite: ${hint}`)
  }
}

function needEnv(...names) {
  const missing = names.filter(n => !process.env[n])
  if (missing.length) throw new Error(`Signing needs these env vars/secrets: ${missing.join(', ')} (see README "Store publishing")`)
  return Object.fromEntries(names.map(n => [n, process.env[n]]))
}

// Monotonic build number (minutes since epoch) so every store upload is higher than the last.
const buildNumber = () => String(Math.floor(Date.now() / 60000))

function desktop({ url, name, icon, version }, outDir) {
  need('cargo --version', 'Rust (https://rustup.rs)')
  const args = [q(url), '--name', q(name), '--app-version', version]
  if (icon) args.push('--icon', q(icon))
  if (HOST === 'linux') args.push('--targets', 'deb,appimage')
  run(`npx -y pake-cli ${args.join(' ')}`, outDir)
}

const ERROR_PAGE = color => `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="margin:0;height:100vh;display:grid;place-items:center;font-family:system-ui;background:${color};text-align:center">
<div><h2>You're offline</h2><p>Check your connection and try again.</p>
<button onclick="location.href=window.APP_URL" style="font:inherit;padding:10px 20px;border-radius:8px;border:1px solid #888">Retry</button></div>
<script>window.APP_URL=${q('__URL__')}</script>`

// Capacitor shell whose webview loads the remote site (server.url), with icon, splash and offline page.
export async function capacitorProject(input, platform) {
  const { url, name, appId, color } = input
  const dir = mkdtempSync(join(tmpdir(), 'origami-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: slug(name), private: true }))
  mkdirSync(join(dir, 'www'))
  writeFileSync(join(dir, 'www', 'index.html'), `<meta http-equiv="refresh" content="0;url=${url}">`)
  writeFileSync(join(dir, 'www', 'error.html'), ERROR_PAGE(color).replace('__URL__', url))
  writeFileSync(join(dir, 'capacitor.config.json'), JSON.stringify({
    appId,
    appName: name,
    webDir: 'www',
    server: { url, errorPath: 'error.html' },
    android: { backgroundColor: color },
    ios: { backgroundColor: color },
  }, null, 2))
  run(`npm i @capacitor/core @capacitor/cli @capacitor/${platform} @capacitor/assets`, dir)
  run(`npx cap add ${platform}`, dir)
  await icons(dir, input, platform)
  return dir
}

async function icons(dir, { url, icon, color }, platform) {
  // ponytail: favicon fallback is often 256px, so icons look soft; pass --icon (1024x1024 PNG) for store-quality icons.
  const src = icon || `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=256`
  try {
    const res = await fetch(src)
    if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) throw new Error(`HTTP ${res.status}`)
    mkdirSync(join(dir, 'assets'))
    writeFileSync(join(dir, 'assets', 'icon.png'), Buffer.from(await res.arrayBuffer()))
    run(`npx capacitor-assets generate --${platform} --iconBackgroundColor ${q(color)} --splashBackgroundColor ${q(color)}`, dir)
  } catch (e) {
    console.warn(`Icon step skipped (${e.message}); using the default icon.`)
  }
}

async function android(input, outDir) {
  need('java -version', 'JDK 21 (https://adoptium.net)')
  if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) throw new Error('Missing prerequisite: Android SDK (set ANDROID_HOME)')
  const s = slug(input.name)
  const dir = await capacitorProject(input, 'android')
  const gradle = join(dir, 'android/app/build.gradle')
  writeFileSync(gradle, readFileSync(gradle, 'utf8')
    .replace(/versionCode \d+/, `versionCode ${buildNumber()}`)
    .replace(/versionName "[^"]*"/, `versionName "${input.version}"`))

  if (input.release === 'none') {
    run(process.platform === 'win32' ? 'gradlew.bat assembleDebug' : './gradlew assembleDebug', join(dir, 'android'))
    cpSync(join(dir, 'android/app/build/outputs/apk/debug/app-debug.apk'), join(outDir, `${s}.apk`))
    return
  }

  const e = needEnv('ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD')
  const keystore = join(dir, 'release.keystore')
  writeFileSync(keystore, Buffer.from(e.ANDROID_KEYSTORE_BASE64, 'base64'))
  const cap = join(dir, 'node_modules/@capacitor/cli/bin/capacitor')
  for (const type of ['APK', 'AAB']) {
    // execFile (no shell) so passwords with special characters pass through untouched.
    execFileSync('node', [cap, 'build', 'android', '--keystorepath', keystore, '--keystorepass', e.ANDROID_KEYSTORE_PASSWORD,
      '--keystorealias', e.ANDROID_KEY_ALIAS, '--keystorealiaspass', e.ANDROID_KEY_PASSWORD, '--androidreleasetype', type], { cwd: dir, stdio: 'inherit' })
  }
  const outputs = join(dir, 'android/app/build/outputs')
  for (const f of readdirSync(outputs, { recursive: true }).map(String).filter(f => /release.*\.(apk|aab)$/.test(f) && !f.includes('unsigned'))) {
    cpSync(join(outputs, f), join(outDir, `${s}${f.slice(f.lastIndexOf('.'))}`))
  }
}

const plist = obj => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>${Object.entries(obj).map(([k, v]) => `<key>${k}</key><string>${v}</string>`).join('')}</dict></plist>`

async function ios(input, outDir) {
  need('xcodebuild -version', 'Xcode (macOS only)')
  const s = slug(input.name)
  const dir = await capacitorProject(input, 'ios')
  const app = join(dir, 'ios/App')
  const project = existsSync(join(app, 'App.xcworkspace')) ? '-workspace App.xcworkspace' : '-project App.xcodeproj'
  const ver = `MARKETING_VERSION=${input.version} CURRENT_PROJECT_VERSION=${buildNumber()}`

  if (input.release === 'none') {
    run(`xcodebuild ${project} -scheme App -sdk iphonesimulator -configuration Debug -derivedDataPath build CODE_SIGNING_ALLOWED=NO ${ver}`, app)
    run(`ditto -c -k --keepParent build/Build/Products/Debug-iphonesimulator/App.app ${q(join(outDir, `${s}-ios-simulator.zip`))}`, app)
    // Unsigned project: open in Xcode, pick your team, Archive.
    run(`zip -qr ${q(join(outDir, `${s}-ios-project.zip`))} . -x "ios/App/build/*"`, dir)
    return
  }

  const e = needEnv('APPLE_TEAM_ID', 'ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_KEY_P8')
  for (const k of ['APPLE_TEAM_ID', 'ASC_KEY_ID', 'ASC_ISSUER_ID']) if (!/^[\w-]+$/.test(e[k])) throw new Error(`${k} has unexpected characters`)
  const key = join(dir, 'AuthKey.p8')
  writeFileSync(key, e.ASC_KEY_P8)
  // App Store Connect API key lets Xcode create certificates/profiles itself (automatic signing).
  const auth = `-allowProvisioningUpdates -authenticationKeyPath ${q(key)} -authenticationKeyID ${e.ASC_KEY_ID} -authenticationKeyIssuerID ${e.ASC_ISSUER_ID}`
  run(`xcodebuild ${project} -scheme App -configuration Release -destination generic/platform=iOS -archivePath build/App.xcarchive archive DEVELOPMENT_TEAM=${e.APPLE_TEAM_ID} CODE_SIGN_STYLE=Automatic ${ver} ${auth}`, app)
  const upload = input.release === 'store'
  writeFileSync(join(dir, 'export.plist'), plist({ method: 'app-store-connect', destination: upload ? 'upload' : 'export', teamID: e.APPLE_TEAM_ID, signingStyle: 'automatic' }))
  run(`xcodebuild -exportArchive -archivePath build/App.xcarchive -exportOptionsPlist ${q(join(dir, 'export.plist'))} -exportPath build/export ${auth}`, app)
  if (upload) console.log('Uploaded to App Store Connect; it appears in TestFlight after processing (~10-30 min).')
  else cpSync(join(app, 'build/export/App.ipa'), join(outDir, `${s}.ipa`))
}

const BUILDERS = { windows: desktop, macos: desktop, linux: desktop, android, ios }

export async function buildTarget({ target, outDir = 'out', ...raw }) {
  const err = validate({ ...raw, targets: [target] })
  if (err) throw new Error(err)
  if (!canBuildLocally(target)) throw new Error(`${target} can't be built on ${HOST}; use CI (--remote).`)
  outDir = resolve(outDir)
  mkdirSync(outDir, { recursive: true })
  await BUILDERS[target](normalize(raw), outDir)
  return outDir
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const str = { type: 'string', default: '' }
  const { values: v } = parseArgs({ options: { target: str, url: str, name: str, icon: str, 'app-id': str, 'app-version': str, color: str, release: str, out: { type: 'string', default: 'out' } } })
  try {
    const out = await buildTarget({ target: v.target, url: v.url, name: v.name, icon: v.icon, appId: v['app-id'], version: v['app-version'], color: v.color, release: v.release, outDir: v.out })
    console.log(`Done → ${out}`)
  } catch (e) {
    console.error(`Error: ${e.message}`)
    process.exit(1)
  }
}
