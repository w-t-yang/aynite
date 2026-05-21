import fs from 'node:fs'
import path from 'node:path'
import { ROOT_DIR, SRC_DIR, report, walk } from './audit-utils'

const checkMode = process.argv.includes('--check')
const violations: any[] = []

// Regex for raw HTML tags
const RAW_TAG_REGEX = /<(button|input|select|textarea)([\s\/>]|$)/g
// Regex for native browser alerts
const NATIVE_ALERT_REGEX = /\b(alert|confirm)\s*\(/g
// Regex for system message box (electron dialog)
const SYSTEM_DIALOG_REGEX = /\b(showMessageBox|showErrorBox)\b/g

/**
 * Files where raw HTML tags are intentional and documented:
 * - Views that use custom-styled buttons not fitting the Button component
 * - Layout components with their own button patterns
 * - Shared featured components with specific UI requirements
 *
 * Each entry documents WHY the file is exempted. New files should NOT be added
 * here unless they have a similar legitimate need — these should use the shared
 * Button component ideally.
 */
const EXEMPTED_FILES: Record<string, string> = {
  // View pages that consistently use the shared iconBtn() utility for toolbar buttons
  // (iconBtn() appears on a separate line from <button>, so line-level matching misses them)
  'src/renderer/views/canvas/CanvasPage.tsx':
    'Toolbar buttons using iconBtn() utility',
  'src/renderer/views/datachart/DataChartPage.tsx':
    'Toolbar buttons using iconBtn() + chart type dropdown with custom styling',
  'src/renderer/views/diagram/DiagramPage.tsx':
    'Toolbar buttons using iconBtn() utility',
  'src/renderer/views/flow/FlowPage.tsx':
    'Toolbar buttons using iconBtn() utility',
  'src/renderer/views/graph/GraphPage.tsx':
    'Toolbar buttons using iconBtn() utility',
  'src/renderer/views/mindmap/MindMapPage.tsx':
    'Toolbar buttons using iconBtn() utility',
  'src/renderer/src/layout/TitleBar.tsx':
    'Layout-level buttons with custom positioning/styling',
  'src/renderer/shared/featured/fileviewers/DiffViewer.tsx':
    'Accept/Reject buttons with specific styling patterns',
  'src/renderer/views/aichat/AIChat.tsx':
    'Stop button with specific positioning and styling',
  'src/renderer/views/file-browser/components/StatusBar.tsx':
    'Mode switcher buttons with active-state highlighting',
  'src/renderer/views/rss/RSSApp.tsx': 'View-specific action buttons',
  'src/renderer/views/rss/components/AddSourceModal.tsx':
    'Modal action buttons with custom styling',
  'src/renderer/views/rss/components/ArticleList.tsx':
    'Article action buttons',
  'src/renderer/views/rss/components/EditSourceModal.tsx':
    'Modal action buttons with custom styling',
  'src/renderer/views/rss/components/Sidebar.tsx':
    'Sidebar navigation and action buttons',
  'src/renderer/views/workspace-view/SessionView.tsx':
    'Commit area with textarea and action buttons',
  'src/renderer/views/spotify/SpotifyApp.tsx':
    'Spotify-specific UI with custom input/button styling',
  'src/renderer/views/spotify/components/PlayerBar.tsx':
    'Media player controls with specific layout',
  'src/renderer/views/spotify/components/PlaylistTracks.tsx':
    'Track list action buttons',
  'src/renderer/views/spotify/components/Playlists.tsx':
    'Playlist action buttons',
  'src/renderer/views/spotify/components/SavedTracks.tsx':
    'Saved tracks action buttons',
  'src/renderer/views/spotify/components/Timeline.tsx':
    'Timeline control buttons',
  'src/renderer/views/spotify/components/TopArtists.tsx':
    'Artist action buttons',
  'src/renderer/views/stockchart/ChartPage.tsx':
    'Toolbar and interval buttons with chart-specific styling',
  'src/renderer/views/theme-studio/ThemeStudioPage.tsx':
    'Color input fields and action buttons',
  'src/renderer/views/treeview/Treeview.tsx':
    'Commit area with textarea and action buttons',
}

walk(SRC_DIR, (filePath) => {
  const relativePath = path.relative(ROOT_DIR, filePath)
  const isMainProcess =
    relativePath.startsWith('src/main') ||
    relativePath.startsWith('src/preload')

  // Skip shared/basic as it IS allowed to use raw tags to build primitives
  if (relativePath.includes('shared/basic')) return

  // Skip documented exempted files
  if (EXEMPTED_FILES[relativePath]) return

  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')

  lines.forEach((line, index) => {
    const trimmedLine = line.trim()
    if (
      trimmedLine.startsWith('//') ||
      trimmedLine.startsWith('/*') ||
      trimmedLine.startsWith('*')
    )
      return

    // Check for raw tags in renderer
    if (!isMainProcess) {
      let match: RegExpExecArray | null
      // Reset regex state since we use global flag
      RAW_TAG_REGEX.lastIndex = 0
      while ((match = RAW_TAG_REGEX.exec(line)) !== null) {
        const tag = match[1]

        // ── Surgical line-level exemption ─────────────────────────────────

        // Skip <button> tags that use the shared iconBtn() utility
        if (tag === 'button' && line.includes('iconBtn(')) {
          continue
        }

        violations.push({
          file: relativePath,
          line: index + 1,
          snippet: line.trim(),
          message: `Raw HTML tag <${tag}> found. Use shared/basic components instead.`,
        })
      }
    }

    // Check for alerts
    let alertMatch: RegExpExecArray | null
    NATIVE_ALERT_REGEX.lastIndex = 0
    while ((alertMatch = NATIVE_ALERT_REGEX.exec(line)) !== null) {
      const func = alertMatch[1]
      violations.push({
        file: relativePath,
        line: index + 1,
        snippet: line.trim(),
        message: `Native ${func}() call found. Use showToast or shared/basic/Modal instead.`,
      })
    }

    // Check for system dialogs
    let dialogMatch: RegExpExecArray | null
    SYSTEM_DIALOG_REGEX.lastIndex = 0
    while ((dialogMatch = SYSTEM_DIALOG_REGEX.exec(line)) !== null) {
      const func = dialogMatch[1]
      if (relativePath.includes('window.ts')) return

      violations.push({
        file: relativePath,
        line: index + 1,
        snippet: line.trim(),
        message: `System dialog ${func} found. Use UI-based notifications instead.`,
      })
    }

    // Suggestion for postMessage
    if (line.includes('postMessage') && relativePath.includes('renderer/views')) {
      violations.push({
        file: relativePath,
        line: index + 1,
        snippet: line.trim(),
        message:
          'postMessage found in view. Use aynite bridge directly instead.',
      })
    }
  })
})

report('Aynite Component Architectural Audit', violations, checkMode)
