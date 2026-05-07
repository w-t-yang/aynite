import type { AppOperation, ViewOperation } from '../constants/app'

export type AppOperationType = keyof typeof AppOperation
export type ViewOperationType = keyof typeof ViewOperation
