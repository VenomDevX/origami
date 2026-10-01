import { notFound } from 'next/navigation'
import { gh } from '@/lib/github'

type Run = { id: number; display_title: string; status: string; conclusion: string | null; html_url: string }
type Job = { name: string; status: string; conclusion: string | null }
type Asset = { name: string; browser_download_url: string; size: number }

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^ori-[a-z0-9]+$/.test(id)) notFound()

  const runs: { workflow_runs: Run[] } = await gh('/actions/workflows/build.yml/runs?event=workflow_dispatch&per_page=50').then(r => r.json())
  const run = runs.workflow_runs?.find(r => r.display_title === id)
  const jobs: Job[] = run ? (await gh(`/actions/runs/${run.id}/jobs`).then(r => r.json())).jobs ?? [] : []
  const release = await gh(`/releases/tags/${id}`)
  const assets: Asset[] = release.ok ? (await release.json()).assets : []
  const done = run?.status === 'completed'

  return (
    <>
      {!done && <meta httpEquiv="refresh" content="10" />}
      <h1>Build {done ? (run.conclusion === 'success' ? 'finished' : 'finished with errors') : 'in progress'}</h1>
      <p className="muted">Job <code>{id}</code>. {!done && 'This page refreshes on its own every 10 seconds.'}</p>

      <div className="card">
        <strong>Targets</strong>
        {!run && <span className="muted">Queued…</span>}
        <ul>
          {jobs.filter(j => j.name !== 'plan').map(j => (
            <li key={j.name}>{j.name}: {j.conclusion ?? j.status}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        <strong>Downloads</strong>
        {assets.length === 0 && <span className="muted">Files appear here as each target finishes.</span>}
        <ul>
          {assets.map(a => (
            <li key={a.name}>
              <a href={a.browser_download_url}>{a.name}</a> <small>({(a.size / 1e6).toFixed(1)} MB)</small>
            </li>
          ))}
        </ul>
      </div>
      <p><a href="/">← Build another</a></p>
    </>
  )
}
