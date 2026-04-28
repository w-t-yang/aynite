export interface FileInfo {
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  path: string;
  extension: string;
  isText?: boolean;
}

export type FileCategory = 'text' | 'image' | 'video' | 'audio' | 'pdf' | 'markdown' | 'html' | 'unsupported';

export function getFileCategory(extension: string, isText?: boolean): FileCategory {
  const ext = extension.toLowerCase();
  if (['md', 'markdown'].includes(ext)) return 'markdown';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'flac', 'aac', 'm4a'].includes(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  
  if (isText) return 'text';
  
  const textExts = [
    'txt', 'js', 'ts', 'jsx', 'tsx', 'css', 'scss', 'html', 'json', 'yaml', 'yml', 
    'py', 'rs', 'go', 'c', 'cpp', 'h', 'hpp', 'sh', 'bash', 'zsh', 'env', 'gitignore',
    'lock', 'xml', 'sql', 'php', 'rb', 'java', 'kt', 'swift', 'toml', 'ignore'
  ];
  if (textExts.includes(ext) || ext === '') return 'text';
  
  return 'unsupported';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
