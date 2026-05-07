export interface FileInfo {
  size: number
  createdAt: Date
  modifiedAt: Date
  path: string
  extension: string
  isText?: boolean
}

export type FileCategory =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'markdown'
  | 'html'
  | 'unsupported'
