/**
 * Generate a clean animated GIF for the README showing word cycling.
 *
 * Usage: node scripts/make-gifs.mjs
 *
 * Requires: playwright (npm install playwright && npx playwright install chromium)
 *           ffmpeg (brew install ffmpeg)
 */

import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const WORDS = [
  'Hack', 'Build', 'Create', 'Code', 'Ship', 'Craft',
  'Forge', 'Design', 'Make', 'Shape', 'Coffee', 'Pizza',
  'Beer', 'Tea', 'Nap', 'Stretch', 'Walk', 'Chill',
  'Snack', 'Have fun',
]

const HTML = `<!DOCTYPE html>
<html><head><style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 420px;
  height: 64px;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
#w {
  font-size: 28px;
  font-weight: 700;
  color: #1f1f1f;
  text-align: center;
  width: 100%;
  padding: 0 16px;
  white-space: nowrap;
  transition: opacity 0.25s ease-in-out;
}
</style></head>
<body><div id="w">${WORDS[0]}</div>
<script>
const words = ${JSON.stringify(WORDS)};
let idx = 0;

window.nextWord = function() {
  const el = document.getElementById('w');
  el.style.opacity = '0';
  setTimeout(() => {
    idx = (idx + 1) % words.length;
    el.textContent = words[idx];
    el.style.opacity = '1';
  }, 250);
};
</script></body></html>`

async function main() {
  const outputPath = join('docs', 'images', 'welcome-animated.gif')
  console.log(`Generating ${outputPath}...`)

  const tmpDir = mkdtempSync(join(tmpdir(), 'aynite-gif-'))
  const htmlPath = join(tmpDir, 'page.html')
  writeFileSync(htmlPath, HTML)

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 420, height: 64 } })
  await page.goto('file://' + htmlPath)
  await page.waitForTimeout(200)

  const framesDir = join(tmpDir, 'frames')
  execSync(`mkdir -p ${framesDir}`)

  let frameIdx = 0
  const cap = async () => {
    const buf = await page.screenshot({ type: 'png' })
    const pad = String(frameIdx++).padStart(4, '0')
    writeFileSync(join(framesDir, `frame-${pad}.png`), buf)
  }

  for (let w = 0; w < WORDS.length; w++) {
    // Show word clearly (hold for ~1s)
    for (let i = 0; i < 14; i++) { await cap(); await page.waitForTimeout(75) }

    // Fade out
    await page.evaluate(() => { document.getElementById('w').style.opacity = '0' })
    for (let i = 0; i < 5; i++) { await cap(); await page.waitForTimeout(50) }

    // Change text (at low opacity)
    await page.evaluate(() => window.nextWord())

    // Fade in
    for (let i = 0; i < 5; i++) { await cap(); await page.waitForTimeout(50) }
  }

  // Hold last word
  for (let i = 0; i < 20; i++) { await cap(); await page.waitForTimeout(75) }

  await browser.close()

  // Optimize GIF with palette
  execSync(
    `ffmpeg -y -framerate 10 -i ${framesDir}/frame-%04d.png ` +
    `-vf "split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" ` +
    `-loop 0 ${outputPath}`,
    { stdio: 'inherit' }
  )

  rmSync(tmpDir, { recursive: true, force: true })
  console.log(`  ✓ ${outputPath} (${frameIdx} frames)`)
}

main().catch(console.error)
