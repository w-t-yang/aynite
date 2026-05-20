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
