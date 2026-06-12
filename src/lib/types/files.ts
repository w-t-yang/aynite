export interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  mtime?: number
  createdAt: number | Date
  modifiedAt: number | Date
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

export interface DiffStats {
  additions: number
  deletions: number
}

export type GitStatusType =
  | 'untracked'
  | 'ignored'
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'none'

export interface GitStatusMap {
  [path: string]: GitStatusType
}

export interface HunkData {
  filePath: string
  oldStart: number
  oldLines: string[]
  newStart: number
  newLines: string[]
}

export interface RootFinder {
  findGitRoot(path: string): Promise<string | null>
  clearCache(): void
}

export interface FileNode {
  id: string
  name: string
  isDirectory: boolean
  isLoaded?: boolean
  children?: FileNode[]
}
