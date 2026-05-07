import type React from 'react'
import {
  AudioViewer,
  HtmlViewer,
  ImageViewer,
  MarkdownViewer,
  PdfViewer,
  UnsupportedViewer,
  VideoViewer,
} from '../../../renderer/shared/featured/fileviewers'
import type { FileCategory, FileInfo } from '../../types/files'

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
  text: () => null,
  unsupported: UnsupportedViewer,
}
