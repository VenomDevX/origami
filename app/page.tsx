'use client'

import { useActionState } from 'react'
import { startBuild } from './actions'

const TARGETS = [
  ['android', 'Android (.apk)'],
  ['ios', 'iOS (Xcode project)'],
  ['windows', 'Windows (.msi)'],
  ['macos', 'macOS (.dmg)'],
  ['linux', 'Linux (.deb / .AppImage)'],
]

export default function Home() {
  const [state, action, pending] = useActionState(startBuild, {})
  return (
    <>
      <h1>Origami</h1>
      <p className="lead">Turn any website into apps for Android, iOS, Windows, macOS and Linux.</p>

      <form action={action}>
        <label>
          Website URL
          <input type="url" name="url" required placeholder="https://example.com" pattern="https://.*" />
        </label>
        <label>
          App name
          <input type="text" name="name" required maxLength={30} pattern="[A-Za-z0-9 ]+" placeholder="My App" />
        </label>
        <label>
          Icon URL <small>(optional; a 1024×1024 PNG works best. If empty, the site&apos;s favicon is used.)</small>
          <input type="url" name="icon" placeholder="https://example.com/icon.png" />
        </label>
        <details>
          <summary>Advanced options</summary>
          <div className="advanced">
            <label>
              App ID <small>(e.g. com.yourcompany.app; it can&apos;t be changed after publishing)</small>
              <input type="text" name="appId" placeholder="app.origami.myapp" pattern="[a-zA-Z][a-zA-Z0-9_]*(.[a-zA-Z][a-zA-Z0-9_]*)+" />
            </label>
            <label>
              Version
              <input type="text" name="version" placeholder="1.0.0" pattern="d+.d+.d+" />
            </label>
            <label className="inline">
              <input type="color" name="color" defaultValue="#ffffff" /> Icon background, splash screen and offline-page color
            </label>
          </div>
        </details>
        <fieldset>
          <legend>Build for</legend>
          {TARGETS.map(([value, label]) => (
            <label key={value}>
              <input type="checkbox" name="targets" value={value} defaultChecked={value === 'android'} /> {label}
            </label>
          ))}
        </fieldset>
        {state.error && <p className="error" role="alert">{state.error}</p>}
        <button disabled={pending}>{pending ? 'Starting…' : 'Build apps'}</button>
      </form>

      <details>
        <summary>Good to know</summary>
        <ul>
          <li>Mobile apps get your icon, a splash screen and an offline page that appears when the internet is down.</li>
          <li><strong>Publishing to Google Play or the App Store:</strong> this needs your own signing keys, so it isn&apos;t done on this site. Fork Origami on GitHub, add your keys as secrets, and run it with <code>--publish</code>. The README has a step-by-step guide.</li>
          <li>The app shows your live website in a native window. When you update the site, the app updates too.</li>
          <li>iOS: you get an unsigned Xcode project. To install it on a phone or publish it, open it in Xcode on a Mac and sign it with your Apple Developer account.</li>
          <li>The Android APK is debug-signed, which is fine for sideloading. The macOS .dmg is unsigned, so macOS shows a warning when you open it.</li>
          <li>Converting a finished app (e.g. a Windows .exe) to another OS isn&apos;t possible. Only websites can be converted.</li>
          <li>A build takes about 5–15 minutes.</li>
        </ul>
      </details>
    </>
  )
}
