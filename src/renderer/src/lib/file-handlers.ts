export interface FileInfo {
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  path: string;
  extension: string;
  isText?: boolean;
}

export type FileCategory = 'text' | 'image' | 'video' | 'audio' | 'pdf' | 'markdown' | 'html' | 'unsupported';

/**
 * Determines the file category based on extension, text content check, and filename.
 */
export function getFileCategory(extension: string): FileCategory;
export function getFileCategory(extension: string, isText: boolean | undefined): FileCategory;
export function getFileCategory(extension: string, isText: boolean | undefined, filePath: string | undefined): FileCategory;
export function getFileCategory(extension: string, isText?: boolean, filePath?: string): FileCategory {
  const ext = extension.toLowerCase();
  
  const binaryExts = {
    image: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'tiff'],
    video: ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'],
    audio: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'opus'],
    pdf: ['pdf'],
    unsupported: [
      'zip', 'tar', 'gz', '7z', 'rar', 'exe', 'dll', 'so', 'dylib', 'bin',
      'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'pyc', 'class', 'o', 'deb', 'wmv'
    ]
  };

  if (['md', 'markdown'].includes(ext)) return 'markdown';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (binaryExts.image.includes(ext)) return 'image';
  if (binaryExts.video.includes(ext)) return 'video';
  if (binaryExts.audio.includes(ext)) return 'audio';
  if (binaryExts.pdf.includes(ext)) return 'pdf';
  if (binaryExts.unsupported.includes(ext)) return 'unsupported';
  
  // If backend explicitly says it's binary via null-byte check, respect it
  if (isText === false) return 'unsupported';
  
  // Default to text for anything else
  return 'text';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
