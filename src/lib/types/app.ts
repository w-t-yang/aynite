import type { AppOperation, ViewOperation } from '../constants/app'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export type AppOperationType = keyof typeof AppOperation
export type ViewOperationType = keyof typeof ViewOperation
