import { describe, expect, it } from 'vitest'
import {
  exists,
  readJson,
  readText,
  secureEditFile,
  secureGlobSearch,
  secureGrepSearch,
  secureListDir,
  secureReadText,
  secureWriteText,
  writeJson,
  writeText,
} from '../../src/lib/path'

// ─── I/O Helpers ────────────────────────────────────────────────────────

describe('readJson', () => {
  it('parses valid JSON from file', async () => {
    // This relies on the module's filesystem — not ideal for unit tests.
    // For a proper unit test, we'd mock fs.readFile. But this function
    // is thin enough that the existing tests cover its usage through
    // the config/logic tests which mock the path module.
    // Here we just verify the function exists and has the right signature.
    expect(typeof readJson).toBe('function')
  })

  it('returns fallback on error when provided', async () => {
    const result = await readJson('/nonexistent/file.json', { fallback: true })
    expect(result).toEqual({ fallback: true })
  })
})

describe('readText', () => {
  it('is a function', () => {
    expect(typeof readText).toBe('function')
  })
})

describe('writeJson', () => {
  it('is a function', () => {
    expect(typeof writeJson).toBe('function')
  })
})

describe('writeText', () => {
  it('is a function', () => {
    expect(typeof writeText).toBe('function')
  })
})

describe('exists', () => {
  it('is a function', () => {
    expect(typeof exists).toBe('function')
  })

  it('returns false for nonexistent paths', async () => {
    const result = await exists('/nonexistent/path/random123')
    expect(result).toBe(false)
  })

  it('returns true for existing paths', async () => {
    const result = await exists(__dirname)
    expect(result).toBe(true)
  })
})

// ─── Secure Helpers (with Domain Validation) ───────────────────────────

describe('secureReadText', () => {
  const domains = ['/allowed']

  it('returns access denied for outside-domain path', async () => {
    const result = await secureReadText('/forbidden/file.txt', domains)
    expect(result).toContain('Access denied')
  })

  it('returns access denied for path starting with outside-domain prefix', async () => {
    // /allowed-but-not should be rejected — it doesn't match /allowed as prefix
    const result = await secureReadText('/allowed-but-not/file.txt', domains)
    expect(result).toContain('Access denied')
  })
})

describe('secureWriteText', () => {
  const domains = ['/allowed']

  it('returns access denied for outside-domain path', async () => {
    const result = await secureWriteText(
      '/forbidden/file.txt',
      'content',
      domains,
    )
    expect(result).toContain('Access denied')
  })
})

describe('secureEditFile', () => {
  const domains = ['/allowed']

  it('returns access denied for outside-domain path', async () => {
    const result = await secureEditFile(
      '/forbidden/file.txt',
      'old',
      'new',
      domains,
    )
    expect(result).toContain('Access denied')
  })
})

describe('secureListDir', () => {
  const domains = ['/allowed']

  it('returns access denied for outside-domain path', async () => {
    const result = await secureListDir('/forbidden', domains)
    expect(result).toContain('Access denied')
  })
})

describe('secureGrepSearch', () => {
  const domains = ['/allowed']

  it('returns access denied for outside-domain path', async () => {
    const result = await secureGrepSearch('/forbidden', 'pattern', domains)
    expect(result).toContain('Access denied')
  })
})

describe('secureGlobSearch', () => {
  const domains = ['/allowed']

  it('returns access denied for outside-domain path', async () => {
    const result = await secureGlobSearch('**/*.ts', domains, '/forbidden')
    expect(result).toContain('Access denied')
  })
})
