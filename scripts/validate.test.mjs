import assert from 'node:assert/strict'
import { normalize, slug, validate } from './validate.mjs'

const ok = { url: 'https://example.com', name: 'My App', targets: ['android'] }
assert.equal(validate(ok), null)
for (const url of ['http://example.com', 'https://localhost', 'https://192.168.1.1', 'https://10.0.0.5', 'https://x.local', 'https://a.com/$(id)', "https://a.com/'x", 'https://a.com/<script>', 'nope'])
  assert.ok(validate({ ...ok, url }), `should reject ${url}`)
assert.ok(validate({ ...ok, name: 'bad;name' }))
assert.ok(validate({ ...ok, targets: [] }))
assert.ok(validate({ ...ok, targets: ['symbian'] }))
assert.ok(validate({ ...ok, icon: 'http://x.com/i.png' }))
assert.ok(validate({ ...ok, appId: 'noDots' }))
assert.ok(validate({ ...ok, appId: 'com.1bad' }))
assert.ok(validate({ ...ok, version: '1.0' }))
assert.ok(validate({ ...ok, color: 'red' }))
assert.ok(validate({ ...ok, release: 'yolo' }))
assert.ok(validate({ ...ok, release: 'store' }), 'store needs an explicit appId')
assert.equal(validate({ ...ok, release: 'store', appId: 'com.me.app', version: '2.1.0', color: '#0a0B0c' }), null)

const n = normalize({ ...ok, name: '9 Lives' })
assert.equal(n.appId, 'app.origami.a9lives')
assert.deepEqual([n.version, n.color, n.release], ['1.0.0', '#ffffff', 'none'])
assert.equal(slug('My  App'), 'my-app')
console.log('validate: all checks passed')
