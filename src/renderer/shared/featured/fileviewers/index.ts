import type { FileCategory, FileInfo } from '../../lib/file-handlers'
import { AudioViewer } from './AudioViewer'
import { HtmlViewer } from './HtmlViewer'
import { ImageViewer } from './ImageViewer'
import { MarkdownViewer } from './MarkdownViewer'
import { PdfViewer } from './PdfViewer'
import { UnsupportedViewer } from './UnsupportedViewer'
import { VideoViewer } from './VideoViewer'

export * from './AudioViewer'
export * from './HtmlViewer'
export * from './ImageViewer'
export * from './MarkdownViewer'
export * from './PdfViewer'
export * from './UnifiedViewer'
export * from './UnsupportedViewer'
export * from './VideoViewer'

export const FileHandlerComponents: Record<
  FileCategory,
  React.FC<{
    file: FileInfo
    content?: string
    reason?: 'too_large' | 'binary' | 'other'
  }>
> = {
  markdown: MarkdownViewer,
  html: HtmlViewer,
  image: ImageViewer,
  video: VideoViewer,
  audio: AudioViewer,
  pdf: PdfViewer,
  text: () => null, // Handled internally by FileViewer
  unsupported: UnsupportedViewer,
}
