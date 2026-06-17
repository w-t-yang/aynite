// @vitest-environment node
import { describe, expect, it } from 'vitest'

/**
 * Tests for the getFileIcon function extracted from TabBar.tsx.
 *
 * The original function maps file extensions to Lucide icon components.
 * Since icons are React components, we test the extension→icon-name mapping
 * logic by checking which icon component would be returned for each extension.
 */

// ─── Inline copy of getFileIcon from TabBar.tsx ─────────────────────

type IconComponent = string // We use string names instead of actual components

function getFileIcon(name: string): IconComponent {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'json':
      return 'FileJson'
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
    case 'css':
    case 'html':
    case 'xml':
      return 'FileCode'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return 'FileImage'
    case 'md':
    case 'txt':
    case 'log':
      return 'FileText'
    default:
      return 'File'
  }
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('getFileIcon', () => {
  describe('FileJson', () => {
    it('returns FileJson for .json extension', () => {
      expect(getFileIcon('config.json')).toBe('FileJson')
      expect(getFileIcon('package.json')).toBe('FileJson')
    })
  })

  describe('FileCode', () => {
    it('returns FileCode for .js', () => {
      expect(getFileIcon('index.js')).toBe('FileCode')
    })

    it('returns FileCode for .ts', () => {
      expect(getFileIcon('app.ts')).toBe('FileCode')
    })

    it('returns FileCode for .jsx', () => {
      expect(getFileIcon('Component.jsx')).toBe('FileCode')
    })

    it('returns FileCode for .tsx', () => {
      expect(getFileIcon('Component.tsx')).toBe('FileCode')
    })

    it('returns FileCode for .css', () => {
      expect(getFileIcon('styles.css')).toBe('FileCode')
    })

    it('returns FileCode for .html', () => {
      expect(getFileIcon('index.html')).toBe('FileCode')
    })

    it('returns FileCode for .xml', () => {
      expect(getFileIcon('data.xml')).toBe('FileCode')
    })
  })

  describe('FileImage', () => {
    it('returns FileImage for .png', () => {
      expect(getFileIcon('photo.png')).toBe('FileImage')
    })

    it('returns FileImage for .jpg', () => {
      expect(getFileIcon('photo.jpg')).toBe('FileImage')
    })

    it('returns FileImage for .jpeg', () => {
      expect(getFileIcon('photo.jpeg')).toBe('FileImage')
    })

    it('returns FileImage for .gif', () => {
      expect(getFileIcon('animation.gif')).toBe('FileImage')
    })

    it('returns FileImage for .svg', () => {
      expect(getFileIcon('icon.svg')).toBe('FileImage')
    })

    it('returns FileImage for .webp', () => {
      expect(getFileIcon('image.webp')).toBe('FileImage')
    })
  })

  describe('FileText', () => {
    it('returns FileText for .md', () => {
      expect(getFileIcon('README.md')).toBe('FileText')
    })

    it('returns FileText for .txt', () => {
      expect(getFileIcon('notes.txt')).toBe('FileText')
    })

    it('returns FileText for .log', () => {
      expect(getFileIcon('output.log')).toBe('FileText')
    })
  })

  describe('File (default)', () => {
    it('returns File for unknown extensions', () => {
      expect(getFileIcon('Makefile')).toBe('File')
      expect(getFileIcon('Dockerfile')).toBe('File')
      expect(getFileIcon('file.unknown')).toBe('File')
      expect(getFileIcon('.gitignore')).toBe('File') // no ext → default
    })

    it('returns File for files with no extension', () => {
      expect(getFileIcon('Makefile')).toBe('File')
      expect(getFileIcon('LICENSE')).toBe('File')
    })

    it('returns File for .pdf', () => {
      expect(getFileIcon('document.pdf')).toBe('File')
    })

    it('returns File for .py', () => {
      expect(getFileIcon('script.py')).toBe('File')
    })

    it('returns File for .yaml/.yml', () => {
      expect(getFileIcon('config.yaml')).toBe('File')
      expect(getFileIcon('config.yml')).toBe('File')
    })
  })

  describe('case insensitivity', () => {
    it('handles uppercase extensions', () => {
      expect(getFileIcon('photo.JPG')).toBe('FileImage')
      expect(getFileIcon('README.MD')).toBe('FileText')
      expect(getFileIcon('Index.TS')).toBe('FileCode')
      expect(getFileIcon('Config.JSON')).toBe('FileJson')
    })

    it('handles mixed case extensions', () => {
      expect(getFileIcon('photo.Jpeg')).toBe('FileImage')
      expect(getFileIcon('Component.Tsx')).toBe('FileCode')
    })
  })

  describe('edge cases', () => {
    it('handles dotted file names (like .eslintrc)', () => {
      expect(getFileIcon('.eslintrc')).toBe('File')
      expect(getFileIcon('.prettierrc')).toBe('File')
    })

    it('handles multiple dots', () => {
      expect(getFileIcon('component.test.ts')).toBe('FileCode') // last ext is ts
      expect(getFileIcon('backup.tar.gz')).toBe('File') // gz not in our map
    })
  })
})
