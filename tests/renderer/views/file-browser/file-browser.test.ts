import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock pdfjs-dist which is imported transitively through fileviewComponents
// (used by useFileModes). pdfjs needs DOMMatrix which isn't available in Node.
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}))

vi.mock('pdfjs-dist/build/pdf.worker.min', () => ({}))

// Mock lucide-react icons (used by FileSearchBar)
vi.mock('lucide-react', () => ({
  Search: 'Search',
  X: 'X',
  ChevronUp: 'ChevronUp',
  ChevronDown: 'ChevronDown',
}))

// Setup window.aynite mock
beforeEach(() => {
  vi.clearAllMocks()
  ;(globalThis as any).window = {
    aynite: {
      getConfig: vi.fn(() => Promise.resolve(null)),
      setConfig: vi.fn(() => Promise.resolve()),
      onAppEvent: vi.fn(() => vi.fn()),
      onAppOperation: vi.fn(() => vi.fn()),
    },
  }
})

describe('useFileTabs', () => {
  it('exports useFileTabs hook', async () => {
    const mod = await import(
      '../../../../src/renderer/views/file-browser/hooks/useFileTabs'
    )
    expect(typeof mod.useFileTabs).toBe('function')
  })
})

describe('useFileContent', () => {
  it('exports useFileContent hook', async () => {
    const mod = await import(
      '../../../../src/renderer/views/file-browser/hooks/useFileContent'
    )
    expect(typeof mod.useFileContent).toBe('function')
  })
})

describe('useFileModes', () => {
  it('exports useFileModes hook', async () => {
    const mod = await import(
      '../../../../src/renderer/views/file-browser/hooks/useFileModes'
    )
    expect(typeof mod.useFileModes).toBe('function')
  })
})

describe('useSearchBar', () => {
  it('exports useSearchBar hook', async () => {
    const mod = await import(
      '../../../../src/renderer/views/file-browser/hooks/useSearchBar'
    )
    expect(typeof mod.useSearchBar).toBe('function')
  })
})

describe('FileSearchBar', () => {
  it('exports FileSearchBar component', async () => {
    const mod = await import(
      '../../../../src/renderer/views/file-browser/components/FileSearchBar'
    )
    expect(typeof mod.FileSearchBar).toBe('function')
  })
})
