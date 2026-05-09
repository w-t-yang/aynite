import { highlight, languages } from 'prismjs'
import { langMap } from '../../../lib/constants/renderer/syntax'

// Load Prism languages
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

export { langMap }

export function highlightCode(code: string, extension: string) {
  const lang = langMap[extension] || languages.clike || languages.plain
  return highlight(code, lang, extension || 'text')
}
