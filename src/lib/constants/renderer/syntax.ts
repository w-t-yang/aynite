import { languages } from 'prismjs'

// Load Prism languages (re-imported here to ensure they are available to the constants)
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

export const langMap: any = {
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
