/**
 * Bridge module: Git operations
 *
 * Typed getters and setters for git status, staging, and commits.
 * Setters return Promise<void> — git-status-changed events update views.
 */

function getAynite() {
  if (!window.aynite) {
    throw new Error('Aynite bridge not available (not running in Electron?)')
  }
  return window.aynite
}

interface DiffStats {
  additions: number
  deletions: number
}

interface HunkData {
  filePath: string
  oldStart: number
  oldLines: string[]
  newStart: number
  newLines: string[]
}

// ── Getters (return data) ────────────────────────────────────────────

export const git = (() => ({
  getStatus: (path: string): Promise<Record<string, string> | null> =>
    (getAynite() as any).getGitStatus(path),

  refreshStatus: (path: string): Promise<Record<string, string> | null> =>
    (getAynite() as any).refreshGitStatus(path),

  getHeadContent: (path: string): Promise<string | null> =>
    (getAynite() as any).getGitHeadContent(path),

  getIndexContent: (path: string): Promise<string | null> =>
    (getAynite() as any).getGitIndexContent(path),

  getDiffStats: (root: string): Promise<Record<string, DiffStats>> =>
    (getAynite() as any).getGitDiffStats(root),

  checkIsRoot: (path: string): Promise<boolean> =>
    (getAynite() as any).checkIsGitRoot(path),
}))()

// ── Setters (return void — state changes come through events) ────────

export const gitMutations = (() => ({
  stageHunk: (data: HunkData): Promise<{ error?: string }> =>
    (getAynite() as any).stageHunk(data),

  discardHunk: (data: HunkData): Promise<{ error?: string }> =>
    (getAynite() as any).discardHunk(data),

  commitGenerate: (
    root: string,
  ): Promise<{ message?: string; error?: string }> =>
    (getAynite() as any).commitGenerate(root),

  commitExecute: (
    root: string,
    message: string,
  ): Promise<{ success?: boolean; error?: string }> =>
    (getAynite() as any).commitExecute(root, message),
}))()
