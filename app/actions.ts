'use server'

import { redirect } from 'next/navigation'
import { randomBytes } from 'node:crypto'
import { gh } from '@/lib/github'
import { validate } from '@/scripts/validate.mjs'

const field = (form: FormData, key: string) => String(form.get(key) ?? '').trim()

export async function startBuild(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  // The public site only makes test builds; signing/publishing needs the user's own keys, so it runs in their own fork.
  const input = {
    url: field(form, 'url'),
    name: field(form, 'name'),
    icon: field(form, 'icon'),
    appId: field(form, 'appId'),
    version: field(form, 'version'),
    color: field(form, 'color'),
    targets: form.getAll('targets').map(String),
    release: 'none',
  }
  const error = validate(input)
  if (error) return { error }

  const jobId = `ori-${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
  const res = await gh('/actions/workflows/build.yml/dispatches', {
    method: 'POST',
    body: JSON.stringify({
      ref: 'main',
      inputs: {
        url: input.url, name: input.name, icon: input.icon, targets: input.targets.join(','), job_id: jobId,
        app_id: input.appId, version: input.version, color: input.color, release: 'none',
      },
    }),
  })
  if (!res.ok) {
    console.error('dispatch failed', res.status, await res.text())
    return { error: 'Could not start the build. Try again in a minute.' }
  }
  redirect(`/job/${jobId}`)
}
