import type React from 'react'
import type { FileInfo } from '../../lib/file-handlers'
import { UnifiedViewer } from './UnifiedViewer'

export const PdfViewer: React.FC<{ file: FileInfo }> = ({ file }) => (
  <UnifiedViewer src={`aynite-resource://${file.path}`} padding="p-0" />
)
