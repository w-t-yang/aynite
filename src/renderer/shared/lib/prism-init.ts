/**
 * Ensures Prism is available as a global before language components are loaded.
 * This must be a separate module so that it evaluates before component imports.
 */
import Prism from 'prismjs'
;(globalThis as any).Prism = Prism
export default Prism
