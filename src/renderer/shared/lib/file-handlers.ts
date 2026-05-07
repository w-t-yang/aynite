import type { FileCategory, FileInfo } from '../../../lib/types/files'

export type { FileCategory, FileInfo }

/**
 * Purely behavior-driven file detection. No whitelists or blacklists for text files.
 */
export function getFileCategory(extension: string): FileCategory
export function getFileCategory(
  extension: string,
  isText: boolean | undefined,
): FileCategory
export function getFileCategory(
  extension: string,
  isText: boolean | undefined,
  filePath: string | undefined,
): FileCategory
export function getFileCategory(
  extension: string,
  isText?: boolean,
  _filePath?: string,
): FileCategory {
  const ext = (extension || '').toLowerCase()

  // 1. Specialized Viewers (Only for binary media we actually handle)
  const binaryMedia = {
    image: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'tiff'],
    video: ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'],
    audio: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'opus'],
    pdf: ['pdf'],
  }

  const structuredText = {
    markdown: ['md', 'markdown'],
    html: ['html', 'htm'],
  }

  if (structuredText.markdown.includes(ext)) return 'markdown'
  if (structuredText.html.includes(ext)) return 'html'
  if (binaryMedia.image.includes(ext)) return 'image'
  if (binaryMedia.video.includes(ext)) return 'video'
  if (binaryMedia.audio.includes(ext)) return 'audio'
  if (binaryMedia.pdf.includes(ext)) return 'pdf'

  // 2. The Text File Rule
  // If the backend says it's binary (null bytes found), it's unsupported.
  if (isText === false) return 'unsupported'

  // 3. Fallback: Everything else is treated as text
  // This covers .js, .tsx, .txt, and extensionless files like 'ignore' or 'test'.
  return 'text'
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}
