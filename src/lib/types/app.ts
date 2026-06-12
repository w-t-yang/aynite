import type { AppOperation, ViewOperation } from '../constants/app'

export interface UpdateActions {
  setChecking: () => void
  setAvailable: (info: any) => void
  setIdle: () => void
  setError: (err: string) => void
  setDownloading: (percent: number) => void
  setDownloaded: (info: any) => void
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export type AppOperationType = keyof typeof AppOperation
export type ViewOperationType = keyof typeof ViewOperation
