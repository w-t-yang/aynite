// Import prism-init FIRST to set the global Prism before component files evaluate
import Prism from './prism-init'

// Load Prism language components (these register on Prism.languages via side-effect)
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-yaml'
import 'prism-themes/themes/prism-vsc-dark-plus.css'

const { languages } = Prism

const langMap: Record<string, any> = {
  js: languages.js,
  ts: languages.typescript,
  tsx: languages.typescript,
  jsx: languages.js,
  json: languages.json,
  css: languages.css,
  html: languages.html,
  py: languages.python,
  rs: languages.rust,
  sh: languages.bash,
  bash: languages.bash,
  yaml: languages.yaml,
  yml: languages.yaml,
  md: languages.markdown,
}

export { langMap }

export function highlightCode(code: string, extension: string) {
  const lang = langMap[extension] || languages.clike || languages.plain
  return Prism.highlight(code, lang, extension || 'text')
}

/**
 * Walks all text nodes in a DOM tree (depth-first) and calls the callback.
 * Skips nodes already inside <mark> elements to avoid re-processing.
 */
function walkTextNodes(node: Node, callback: (textNode: Text) => void): void {
  if (node.nodeType === Node.TEXT_NODE) {
    callback(node as Text)
    return
  }
  if (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as HTMLElement).tagName === 'MARK'
  ) {
    return
  }
  let child = node.firstChild
  while (child) {
    const next = child.nextSibling
    walkTextNodes(child, callback)
    child = next
  }
}

/**
 * Takes Prism-highlighted HTML and the original code search query,
 * then uses DOM manipulation to wrap each match in <mark> tags.
 *
 * Why DOM instead of string placeholders?
 * - Prism tokenizes special chars (@, #, etc.) causing placeholders to split
 *   across HTML <span> tags, making string replacement fail and leak garbage.
 * - DOM manipulation works on decoded text nodes, immune to HTML structure.
 */
export function highlightWithSearch(
  code: string,
  extension: string,
  searchQuery?: string,
  activeMatchIndex?: number,
): string {
  if (!searchQuery) return highlightCode(code, extension)

  const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const searchRe = new RegExp(escaped, 'gi')

  // Quick check: if no matches in the plain code, skip highlighting
  if (!searchRe.test(code)) return highlightCode(code, extension)
  searchRe.lastIndex = 0 // reset after test

  // 1. Run Prism on the ORIGINAL (unmodified) code
  const prismHtml = highlightCode(code, extension)

  // 2. Parse into a temporary DOM tree
  const container = document.createElement('div')
  container.innerHTML = prismHtml

  // 3. Walk text nodes, wrap matches in <mark>
  let matchIndex = 0
  walkTextNodes(container, (textNode) => {
    const text = textNode.textContent ?? ''
    if (!text) return

    // Collect all matches in this text node
    const matches: RegExpExecArray[] = []
    let m: RegExpExecArray | null
    while ((m = searchRe.exec(text)) !== null) {
      matches.push(m)
    }
    if (matches.length === 0) return

    // Build replacement fragments
    const fragments: (Text | HTMLElement)[] = []
    let lastIdx = 0

    for (const match of matches) {
      const idx = match.index
      if (idx === undefined) continue

      // Text before the match
      if (idx > lastIdx) {
        fragments.push(document.createTextNode(text.slice(lastIdx, idx)))
      }

      // The match wrapped in <mark>
      const mark = document.createElement('mark')
      const isActive = matchIndex === (activeMatchIndex ?? 0)
      mark.className = isActive
        ? 'search-match search-match-active'
        : 'search-match'
      mark.textContent = match[0]
      fragments.push(mark)

      lastIdx = idx + match[0].length
      matchIndex++
    }

    // Remaining text after last match
    if (lastIdx < text.length) {
      fragments.push(document.createTextNode(text.slice(lastIdx)))
    }

    // Replace the original text node with the fragments
    const parent = textNode.parentNode
    if (!parent) return
    for (const frag of fragments) {
      parent.insertBefore(frag, textNode)
    }
    parent.removeChild(textNode)
  })

  return container.innerHTML
}

/**
 * Finds the 0-based line number for the n-th search match.
 */
export function getSearchMatchLine(
  code: string,
  searchQuery: string,
  matchIndex: number,
): number | null {
  if (!searchQuery) return null

  const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escaped, 'gi')
  let m: RegExpExecArray | null
  let idx = 0
  while ((m = regex.exec(code)) !== null) {
    if (idx === matchIndex) {
      // Count newlines before this match
      const before = code.slice(0, m.index)
      return before.split('\n').length - 1 // 0-based
    }
    idx++
  }
  return null
}
