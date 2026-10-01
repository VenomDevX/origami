// Shared by the web app, CLI, build script and CI.
export const TARGETS = ['android', 'ios', 'windows', 'macos', 'linux']
export const RELEASES = ['none', 'sign', 'store'] // none = test builds, sign = signed builds, store = signed + upload to stores

const PRIVATE_HOST = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)|\.(local|internal|localhost)$/i

function httpsUrl(value) {
  if (/[$`"'<>\\\s]/.test(value ?? '')) return null // keeps values safe inside shell quotes and HTML
  try {
    const u = new URL(value)
    return u.protocol === 'https:' && !PRIVATE_HOST.test(u.hostname) ? u.href : null
  } catch {
    return null
  }
}

export const slug = name => name.trim().toLowerCase().replace(/\s+/g, '-')

/** Fills optional fields with defaults. Empty strings count as "not set". */
export function normalize(input) {
  const id = slug(input.name ?? '').replace(/-/g, '')
  return {
    ...input,
    icon: input.icon || '',
    appId: input.appId || `app.origami.${/^[a-z]/.test(id) ? id : 'a' + id}`,
    version: input.version || '1.0.0',
    color: input.color || '#ffffff',
    release: input.release || 'none',
  }
}

/** Returns an error message, or null when the (normalized) input is valid. */
export function validate(input) {
  const { url, name, icon, targets, appId, version, color, release } = normalize(input)
  if (!httpsUrl(url)) return 'URL must be a public https:// address.'
  if (!/^[A-Za-z0-9 ]{1,30}$/.test(name ?? '')) return 'App name: 1-30 letters, numbers or spaces.'
  if (icon && !httpsUrl(icon)) return 'Icon must be a public https:// URL.'
  if (!targets?.length || !targets.every(t => TARGETS.includes(t))) return `Pick at least one target: ${TARGETS.join(', ')}.`
  if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(appId)) return 'App ID must look like com.company.app.'
  if (!/^\d+\.\d+\.\d+$/.test(version)) return 'Version must look like 1.0.0.'
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return 'Color must look like #1a2b3c.'
  if (!RELEASES.includes(release)) return `Release must be one of: ${RELEASES.join(', ')}.`
  if (release === 'store' && !input.appId) return 'Publishing needs your own App ID (the one registered in Play Console / App Store Connect).'
  return null
}
