#!/usr/bin/env node
// origami <url> --name "My App" --targets android,windows [options]   (run with --help)
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { buildTarget, canBuildLocally } from '../scripts/build.mjs'
import { TARGETS, validate } from '../scripts/validate.mjs'

const str = { type: 'string', default: '' }
const { values: o, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    name: str, targets: str, icon: str, 'app-id': str, 'app-version': str, color: str,
    sign: { type: 'boolean', default: false },
    publish: { type: 'boolean', default: false },
    remote: { type: 'boolean', default: false },
    repo: { type: 'string', default: process.env.ORIGAMI_REPO },
    out: { type: 'string', default: 'out' },
    help: { type: 'boolean', short: 'h' },
  },
})

const input = {
  url: positionals[0], name: o.name, icon: o.icon, targets: o.targets.split(',').filter(Boolean),
  appId: o['app-id'], version: o['app-version'], color: o.color,
  release: o.publish ? 'store' : o.sign ? 'sign' : 'none',
}
let error = o.help ? null : validate(input)
if (!error && o.publish && !o.remote) error = 'Publishing runs on GitHub Actions; add --remote.'
if (o.help || error) {
  if (error) console.error(`Error: ${error}\n`)
  console.log(`Usage: origami <https-url> --name "My App" --targets ${TARGETS.join(',')} [options]

Options:
  --icon URL           App icon (1024x1024 PNG recommended; default: site favicon)
  --app-id ID          App / bundle ID, e.g. com.company.app (required for --publish)
  --app-version X.Y.Z  Version shown in stores (default 1.0.0)
  --color #RRGGBB      Icon background, splash and offline-page color (default #ffffff)
  --sign               Signed release builds (Android .apk/.aab, iOS .ipa); needs signing env vars
  --publish            Signed builds + upload to Google Play (internal, draft) and TestFlight; implies --sign, needs --remote
  --remote             Build on GitHub Actions (needs gh CLI logged in) and download results
  --repo owner/repo    Repo with the Origami workflow (default: $ORIGAMI_REPO or current repo)
  --out DIR            Output folder (default ./out)`)
  process.exit(error ? 1 : 0)
}

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim()

if (o.remote) {
  const repo = o.repo || gh('repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner')
  const jobId = `ori-${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
  const fields = { url: input.url, name: input.name, targets: input.targets.join(','), job_id: jobId, icon: input.icon, app_id: input.appId, version: input.version, color: input.color, release: input.release }
  gh('workflow', 'run', 'build.yml', '-R', repo, ...Object.entries(fields).flatMap(([k, v]) => ['-f', `${k}=${v}`]))
  console.log(`Started ${jobId} on ${repo}. Waiting for the run…`)
  let runId
  for (let i = 0; i < 30 && !runId; i++) {
    await sleep(3000)
    runId = JSON.parse(gh('run', 'list', '-R', repo, '-w', 'build.yml', '-L', '20', '--json', 'databaseId,displayTitle')).find(r => r.displayTitle === jobId)?.databaseId
  }
  if (!runId) throw new Error('Run did not show up on GitHub; check the Actions tab.')
  let failed = false
  try {
    execFileSync('gh', ['run', 'watch', String(runId), '-R', repo, '--exit-status'], { stdio: 'inherit' })
  } catch {
    failed = true
  }
  execFileSync('gh', ['release', 'download', jobId, '-R', repo, '-D', o.out, '--clobber'], { stdio: 'inherit' })
  console.log(`${failed ? 'Some targets failed. ' : ''}Files are in ${o.out}/`)
  process.exit(failed ? 1 : 0)
}

let failed = false
for (const target of input.targets) {
  if (!canBuildLocally(target)) {
    console.log(`Skipping ${target}: this machine can't build it. Use --remote.`)
    continue
  }
  try {
    console.log(`\n=== ${target} ===`)
    await buildTarget({ ...input, target, outDir: o.out })
  } catch (e) {
    failed = true
    console.error(`${target} failed: ${e.message}`)
  }
}
console.log(`\nFiles are in ${o.out}/`)
process.exit(failed ? 1 : 0)
