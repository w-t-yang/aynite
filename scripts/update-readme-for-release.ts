/**
 * Updates the README.md before a release:
 *   1. Updates the download links to point to the specific version's assets
 *   2. Updates the Aynite commit count (two places in README)
 *   3. Updates the contributors list
 *
 * Usage: npx tsx scripts/update-readme-for-release.ts <version>
 *   version: e.g. "0.1.5" or "v0.1.5"
 *
 * Runs BEFORE `npm version` so README changes are committed with the bump.
 */

import { execSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'

// ── Config ────────────────────────────────────────────────────────────

const SINCE_COMMIT = 'ebe284c07baa0ca79c3c368b0d03ede6056d72cc'
const PRE_AYNITE_CLAUDE = 71
const PRE_AYNITE_ANTIGRAVITY = 224
const REPO = 'w-t-yang/aynite'
const README_PATH = new URL('../README.md', import.meta.url).pathname

// ── Helpers ───────────────────────────────────────────────────────────

function run(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', cwd: process.cwd() }).trim()
}

function normalizeVersion(raw: string): string {
  return raw.replace(/^v/, '')
}

// ── 1. Download Links ─────────────────────────────────────────────────

interface AssetInfo {
  name: string
  url: string
}

async function getReleaseAssets(version: string): Promise<AssetInfo[]> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/releases/tags/v${version}`,
    { headers: { Accept: 'application/vnd.github.v3+json' } },
  )
  if (!res.ok) {
    // Release tag doesn't exist yet (pre-release) — infer from latest
    const fallback = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      { headers: { Accept: 'application/vnd.github.v3+json' } },
    )
    if (!fallback.ok) {
      throw new Error(`GitHub API error: ${res.status}`)
    }
    const fb = await fallback.json()
    const fbTag: string = fb.tag_name.replace(/^v/, '')
    return fb.assets.map((a: any) => ({
      name: a.name.replace(fbTag, version),
      url: a.browser_download_url.replace(`v${fbTag}`, `v${version}`),
    }))
  }
  const data = await res.json()
  return data.assets.map((a: any) => ({
    name: a.name,
    url: a.browser_download_url,
  }))
}

function updateDownloadLinks(readme: string, assets: AssetInfo[]): string {
  const findUrl = (pred: (n: string) => boolean) =>
    assets.find((a) => pred(a.name))?.url ?? null

  const macUrl = findUrl((n) => n.endsWith('.dmg'))
  const linuxUrl = findUrl((n) => n.endsWith('.AppImage'))
  const winUrl = findUrl((n) => n.endsWith('.exe'))

  const orFallback = (url: string | null) =>
    url || `https://github.com/${REPO}/releases/latest`

  // Build the download badges line (no URL encoding — these go into a Markdown URL)
  const badgesLine =
    `[![macOS](https://img.shields.io/badge/macOS-.dmg-black?logo=apple&logoColor=white)](${orFallback(macUrl)})&nbsp; ` +
    `[![Linux](https://img.shields.io/badge/Linux-.AppImage-black?logo=linux&logoColor=white)](${orFallback(linuxUrl)})&nbsp; ` +
    `[![Windows](https://img.shields.io/badge/Windows-.exe-black?logo=windows&logoColor=white)](${orFallback(winUrl)})`

  // Replace only the line inside the Download section's <div align="center">
  // Match: ## Download\n\n<div align="center">\n\n{any content}\n\n</div>
  // Use lazy quantifier .*? so it stops at the FIRST </div> after the download section
  const regex = /(## Download\n\n<div align="center">\n\n).*?(\n\n<\/div>)/s
  const match = readme.match(regex)
  if (!match) {
    console.warn('[WARN] Could not find download section in README')
    return readme
  }
  return readme.replace(regex, `$1${badgesLine}$2`)
}

// ── 2. Commit Counts ─────────────────────────────────────────────────

function getCommitStats() {
  const countStr = run(`git rev-list --count ${SINCE_COMMIT}^..HEAD`)
  const ayniteCommits = Number(countStr)
  const total = PRE_AYNITE_CLAUDE + PRE_AYNITE_ANTIGRAVITY + ayniteCommits
  return {
    ayniteCommits,
    total,
    ayniteRatio: ((ayniteCommits / total) * 100).toFixed(1),
    claudeRatio: ((PRE_AYNITE_CLAUDE / total) * 100).toFixed(1),
    antigravityRatio: ((PRE_AYNITE_ANTIGRAVITY / total) * 100).toFixed(1),
  }
}

function pad(n: number): string {
  return n.toString().padStart(4)
}

function updateCommitCounts(
  readme: string,
  s: ReturnType<typeof getCommitStats>,
): string {
  const lines = [
    `Aynite + DeepSeek-V4-Flash     ${pad(s.ayniteCommits)} commits  (${s.ayniteRatio.padStart(5)}%)`,
    `Claude Code + DeepSeek-V4-Flash ${pad(PRE_AYNITE_CLAUDE)} commits  (${s.claudeRatio.padStart(5)}%)`,
    `Antigravity + Gemini           ${pad(PRE_AYNITE_ANTIGRAVITY)} commits  (${s.antigravityRatio.padStart(5)}%)`,
    `─────────────────────────────────────────`,
    `Total                           ${pad(s.total)} commits`,
  ]

  let result = readme

  // The two code blocks contain identical content. Find them by their
  // surrounding context and replace individually.
  // Each block looks like:
  // > ```\n> Aynite + DeepSeek-V4-Flash ... \n> ```
  const newBlock = '> ```\n' + lines.map((l) => `> ${l}`).join('\n') + '\n> ```'

  // First block: inside AI Coding Agent section, after "Aynite is being built with Aynite."
  // The code block looks like: > ```\n> Aynite + DeepSeek...\n> ```\n>
  // Find the opening > ``` after "Aynite is being built with Aynite."
  const firstStart = 'Aynite is being built with Aynite.'
  const firstIdx = result.indexOf(firstStart)
  if (firstIdx !== -1) {
    const fromFirst = result.indexOf('> ```', firstIdx)
    if (fromFirst !== -1) {
      // Find the closing > ``` — look for the SECOND occurrence after fromFirst
      const closingStart = fromFirst + 5
      const afterFirst = result.indexOf('> ```', closingStart)
      if (afterFirst !== -1) {
        const endFirst = afterFirst + '> ```'.length
        result =
          result.slice(0, fromFirst) + newBlock + result.slice(endFirst)
      }
    }
  }

  // Second block: in Contributing section, after "Aynite Contribution Ratio"
  const secondStart = 'Aynite Contribution Ratio'
  const secondIdx = result.indexOf(secondStart)
  if (secondIdx !== -1) {
    const fromSecond = result.indexOf('> ```', secondIdx)
    if (fromSecond !== -1) {
      const closingStart = fromSecond + 5
      const afterSecond = result.indexOf('> ```', closingStart)
      if (afterSecond !== -1) {
        const endSecond = afterSecond + '> ```'.length
        result =
          result.slice(0, fromSecond) + newBlock + result.slice(endSecond)
      }
    }
  }

  // Update percentages in the blockquote text (two occurrences)
  // First: "Aynite is being built with Aynite." line
  result = result.replace(
    /(> ⚡ \*\*Aynite is being built with Aynite\.\*\* As of today, \*\*)[0-9.]+%(\*\* of Aynite's own commit history \()([0-9]+)( out of )([0-9]+)( commits\))/,
    (_, before, afterPct, n, mid, t, afterText) =>
      `${before}${s.ayniteRatio}%${afterPct}${s.ayniteCommits}${mid}${s.total}${afterText}`,
  )

  // Second: "Aynite Contribution Ratio" line
  result = result.replace(
    /(Up to this point, \*\*)[0-9.]+%(\*\* of the project's commit history has already been authored by Aynite itself)/,
    `$1${s.ayniteRatio}%$2`,
  )

  return result
}

// ── 3. Contributors ──────────────────────────────────────────────────

interface Contributor {
  login: string
  avatar_url: string
  html_url: string
}

async function fetchContributors(): Promise<Contributor[]> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contributors?per_page=100`,
    { headers: { Accept: 'application/vnd.github.v3+json' } },
  )
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
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

async function updateContributors(readme: string): Promise<string> {
  const startMarker = '<!-- contributors:start -->'
  const endMarker = '<!-- contributors:end -->'
  const startIdx = readme.indexOf(startMarker)
  const endIdx = readme.indexOf(endMarker)
  if (startIdx === -1 || endIdx === -1) {
    console.warn('[WARN] Could not find contributors markers')
    return readme
  }
  const contributors = await fetchContributors()
  const rows = renderContributors(contributors)
  return (
    readme.slice(0, startIdx + startMarker.length) +
    `\n\n${rows}\n\n` +
    readme.slice(endIdx)
  )
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  const versionArg = process.argv[2]
  if (!versionArg) {
    console.error('Usage: npx tsx scripts/update-readme-for-release.ts <version>')
    process.exit(1)
  }

  const version = normalizeVersion(versionArg)
  console.log(`📝 Updating README for v${version}...`)

  const stats = getCommitStats()
  console.log(`   Commits: ${stats.ayniteCommits}/${stats.total} (${stats.ayniteRatio}%)`)

  let readme = await readFile(README_PATH, 'utf-8')

  // 1. Commit counts (structural, do first)
  readme = updateCommitCounts(readme, stats)
  console.log('   ✅ Updated commit counts')

  // 2. Download links
  try {
    const assets = await getReleaseAssets(version)
    readme = updateDownloadLinks(readme, assets)
    console.log(`   ✅ Updated download links (${assets.length} assets)`)
  } catch (err) {
    console.warn(`   ⚠️  Could not fetch release assets: ${err}`)
    console.warn('   Using /releases/latest fallback')
    const releasePage = `https://github.com/${REPO}/releases/latest`
    const fallback =
      `[![macOS](https://img.shields.io/badge/macOS-.dmg-black?logo=apple&logoColor=white)](${releasePage})&nbsp; ` +
      `[![Linux](https://img.shields.io/badge/Linux-.AppImage-black?logo=linux&logoColor=white)](${releasePage})&nbsp; ` +
      `[![Windows](https://img.shields.io/badge/Windows-.exe-black?logo=windows&logoColor=white)](${releasePage})`
    readme = readme.replace(
      /(## Download\n\n<div align="center">\n\n).*?(\n\n<\/div>)/s,
      `$1${fallback}$2`,
    )
  }

  // 3. Contributors
  try {
    readme = await updateContributors(readme)
    console.log('   ✅ Updated contributors')
  } catch (err) {
    console.warn(`   ⚠️  Could not update contributors: ${err}`)
  }

  await writeFile(README_PATH, readme, 'utf-8')
  console.log(`\n✅ README.md updated for v${version}!`)
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
