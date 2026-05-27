/**
 * Fetches contributors from the GitHub API and updates the README.
 *
 * Usage: npx tsx scripts/update-contributors.ts
 *
 * Looks for <!-- contributors:start --> / <!-- contributors:end --> markers
 * in README.md and replaces the content between them with clickable avatar
 * links for each contributor.
 */

const REPO = 'w-t-yang/aynite'
const README_PATH = new URL('../README.md', import.meta.url).pathname

interface Contributor {
  login: string
  avatar_url: string
  html_url: string
}

async function fetchContributors(): Promise<Contributor[]> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contributors?per_page=100`,
    {
      headers: { Accept: 'application/vnd.github.v3+json' },
    },
  )
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

function renderContributors(contributors: Contributor[]): string {
  return contributors
    .map(
      (c) =>
        `<a href="${c.html_url}"><img src="${c.avatar_url}&s=64" width="40" height="40" style="border-radius:50%" alt="${c.login}" title="${c.login}"></a>`,
    )
    .join('\n')
}

async function main() {
  const contributors = await fetchContributors()
  const rows = renderContributors(contributors)

  const { readFile, writeFile } = await import('node:fs/promises')
  const readme = await readFile(README_PATH, 'utf-8')

  const startMarker = '<!-- contributors:start -->'
  const endMarker = '<!-- contributors:end -->'

  const startIdx = readme.indexOf(startMarker)
  const endIdx = readme.indexOf(endMarker)

  if (startIdx === -1 || endIdx === -1) {
    console.error('ERROR: Could not find contributors markers in README.md')
    console.error(`  Looking for: ${startMarker} and ${endMarker}`)
    process.exit(1)
  }

  const before = readme.slice(0, startIdx + startMarker.length)
  const after = readme.slice(endIdx)

  const updated = `${before}\n\n${rows}\n\n${after}`
  await writeFile(README_PATH, updated, 'utf-8')

  console.log(`✅ Updated README.md with ${contributors.length} contributors`)
}

main().catch((err) => {
  console.error('Failed to update contributors:', err)
  process.exit(1)
})
