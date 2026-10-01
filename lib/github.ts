import 'server-only'

/** Calls the GitHub REST API scoped to the builder repo (GITHUB_REPO). */
export function gh(path: string, init: RequestInit = {}) {
  return fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
}
