import type React from 'react'
import { FileViewAudio } from '../../renderer/views/fileview-audio/FileViewAudio'
import { FileViewHtml } from '../../renderer/views/fileview-html/FileViewHtml'
import { FileViewImage } from '../../renderer/views/fileview-image/FileViewImage'
import { FileViewMarkdown } from '../../renderer/views/fileview-markdown/FileViewMarkdown'
import { FileViewPdf } from '../../renderer/views/fileview-pdf/FileViewPdf'
import { FileViewVideo } from '../../renderer/views/fileview-video/FileViewVideo'
import type { FileInfo } from '../types/files'

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
