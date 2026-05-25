import type React from 'react'
import type { FileInfo } from '../../../lib/types/files'
import { FileViewAudio } from '../fileview-audio/FileViewAudio'
import { FileViewHtml } from '../fileview-html/FileViewHtml'
import { FileViewImage } from '../fileview-image/FileViewImage'
import { FileViewMarkdown } from '../fileview-markdown/FileViewMarkdown'
import { FileViewPdf } from '../fileview-pdf/FileViewPdf'
import { FileViewVideo } from '../fileview-video/FileViewVideo'

interface FileViewComponentProps {
  file: FileInfo
  content?: string
}

/**
 * Maps fileview directory names to their React components.
 * The directory name (e.g. 'fileview-audio') is used as the key,
 * matching the view directory used in getConfig('view-config', { view: 'fileview-audio' }).
 */
export const fileviewComponents: Record<
  string,
  React.FC<FileViewComponentProps>
> = {
  'fileview-audio': FileViewAudio,
  'fileview-html': FileViewHtml,
  'fileview-image': FileViewImage,
  'fileview-markdown': FileViewMarkdown,
  'fileview-pdf': FileViewPdf,
  'fileview-video': FileViewVideo,
}
