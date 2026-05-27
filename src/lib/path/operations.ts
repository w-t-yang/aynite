/**
 * Filesystem I/O operations and domain-validated security wrappers.
 *
 * All functions here touch the filesystem. They use `expandHome` and
 * `isPathWithinDomain` from ./resolve for path resolution and validation.
 */
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import glob from 'fast-glob'
import { ERROR_MESSAGES } from '../constants/messages'
import { expandHome, isPathWithinDomain } from './resolve'

// ─── I/O Helpers ────────────────────────────────────────────────────────

export async function exists(filePath: string): Promise<boolean> {
  return existsSync(expandHome(filePath))
}

export async function ensureDir(dirPath: string) {
  await fs.mkdir(expandHome(dirPath), { recursive: true })
}

export async function readJson<T = any>(
  filePath: string,
  fallback?: T,
): Promise<T> {
  try {
    const data = await fs.readFile(expandHome(filePath), 'utf-8')
    return JSON.parse(data)
  } catch (e) {
    if (fallback !== undefined) return fallback
    throw e
  }
}

export async function writeJson(filePath: string, data: any) {
  const expanded = expandHome(filePath)
  await ensureDir(path.dirname(expanded))
  await fs.writeFile(expanded, JSON.stringify(data, null, 2), 'utf-8')
}

export async function readText(filePath: string): Promise<string> {
  return await fs.readFile(expandHome(filePath), 'utf-8')
}

export async function readBinary(filePath: string): Promise<Buffer> {
  return await fs.readFile(expandHome(filePath))
}

export async function writeText(filePath: string, content: string) {
  const expanded = expandHome(filePath)
  await ensureDir(path.dirname(expanded))
  await fs.writeFile(expanded, content, 'utf-8')
}

export async function appendText(filePath: string, content: string) {
  const expanded = expandHome(filePath)
  await ensureDir(path.dirname(expanded))
  await fs.appendFile(expanded, content, 'utf-8')
}

export async function readdir(dirPath: string) {
  return await fs.readdir(expandHome(dirPath), { withFileTypes: true })
}

export async function stat(filePath: string) {
  return await fs.stat(expandHome(filePath))
}

export async function unlink(filePath: string) {
  return await fs.unlink(expandHome(filePath))
}

export async function copy(
  src: string,
  dest: string,
  options?: { recursive?: boolean },
) {
  const expandedSrc = expandHome(src)
  const expandedDest = expandHome(dest)
  await ensureDir(path.dirname(expandedDest))
  return await fs.cp(expandedSrc, expandedDest, options)
}

export async function rename(oldPath: string, newPath: string) {
  const expandedOld = expandHome(oldPath)
  const expandedNew = expandHome(newPath)
  await ensureDir(path.dirname(expandedNew))
  await fs.rename(expandedOld, expandedNew)
}

export async function remove(
  filePath: string,
  options?: { recursive?: boolean; force?: boolean },
) {
  await fs.rm(expandHome(filePath), options)
}

export async function checkIsTextFile(filePath: string): Promise<boolean> {
  try {
    const fd = await fs.open(expandHome(filePath), 'r')
    const { bytesRead, buffer } = await fd.read(Buffer.alloc(1024), 0, 1024, 0)
    await fd.close()

    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) return false
    }
    return true
  } catch {
    return false
  }
}

// ─── Secure Helpers (with Domain Validation) ────────────────────────────

async function secureFileOp(
  filePath: string,
  domainFolders: string[],
  op: () => Promise<string>,
  errorMsg: (msg: string) => string,
): Promise<string> {
  if (!isPathWithinDomain(filePath, domainFolders)) {
    return ERROR_MESSAGES.ACCESS_DENIED(filePath)
  }
  try {
    return await op()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return errorMsg(message)
  }
}

export async function secureReadText(
  filePath: string,
  domainFolders: string[],
): Promise<string> {
  return secureFileOp(
    filePath,
    domainFolders,
    () => readText(filePath),
    ERROR_MESSAGES.FILE_READ_ERROR,
  )
}

export async function secureWriteText(
  filePath: string,
  content: string,
  domainFolders: string[],
): Promise<string> {
  return secureFileOp(
    filePath,
    domainFolders,
    async () => {
      await writeText(filePath, content)
      return ERROR_MESSAGES.FILE_WRITE_SUCCESS(filePath)
    },
    ERROR_MESSAGES.FILE_WRITE_ERROR,
  )
}

export async function secureEditFile(
  filePath: string,
  targetContent: string,
  replacementContent: string,
  domainFolders: string[],
): Promise<string> {
  return secureFileOp(
    filePath,
    domainFolders,
    async () => {
      const content = await readText(filePath)
      const parts = content.split(targetContent)

      if (parts.length === 1) {
        return ERROR_MESSAGES.FILE_EDIT_NOT_UNIQUE(0)
      }
      if (parts.length > 2) {
        return ERROR_MESSAGES.FILE_EDIT_NOT_UNIQUE(parts.length - 1)
      }

      const newContent = parts.join(replacementContent)
      await writeText(filePath, newContent)
      return ERROR_MESSAGES.FILE_EDIT_SUCCESS(filePath)
    },
    ERROR_MESSAGES.FILE_EDIT_ERROR,
  )
}

export async function secureListDir(
  dirPath: string,
  domainFolders: string[],
): Promise<string> {
  if (!isPathWithinDomain(dirPath, domainFolders)) {
    return ERROR_MESSAGES.ACCESS_DENIED(dirPath)
  }
  try {
    const files = await readdir(dirPath)
    const entries = files.map(
      (f) => `${f.isDirectory() ? '📁' : '📄'} ${f.name}`,
    )
    return entries.join('\n') || ERROR_MESSAGES.DIR_EMPTY
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return ERROR_MESSAGES.DIR_LIST_ERROR(message)
  }
}

export async function secureGetFileTree(
  dirPath: string,
  domainFolders: string[],
  depth: number = 10,
): Promise<string> {
  if (!isPathWithinDomain(dirPath, domainFolders)) {
    return ERROR_MESSAGES.ACCESS_DENIED(dirPath)
  }
  const tree = await getFileTree(dirPath, depth)
  return tree || ERROR_MESSAGES.DIR_EMPTY
}

const GREP_RESULT_LIMIT = 10_000

export async function secureGrepSearch(
  folderPath: string,
  pattern: string,
  domainFolders: string[],
): Promise<string> {
  if (!isPathWithinDomain(folderPath, domainFolders)) {
    return ERROR_MESSAGES.ACCESS_DENIED(folderPath)
  }
  const results = await grepSearch(folderPath, pattern)
  if (results.length > GREP_RESULT_LIMIT) {
    return ERROR_MESSAGES.GREP_RESULT_TOO_LARGE(GREP_RESULT_LIMIT)
  }
  return results.join('\n') || ERROR_MESSAGES.NO_MATCHES_FOUND
}

export async function secureGlobSearch(
  pattern: string,
  domainFolders: string[],
  cwd?: string,
): Promise<string> {
  const searchCwd = cwd || domainFolders[0]
  if (!isPathWithinDomain(searchCwd, domainFolders)) {
    return ERROR_MESSAGES.ACCESS_DENIED(searchCwd)
  }

  try {
    const files = await glob(pattern, {
      cwd: expandHome(searchCwd),
      onlyFiles: true,
      absolute: true,
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/out/**'],
    })
    return files.join('\n') || ERROR_MESSAGES.NO_MATCHES_FOUND
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return ERROR_MESSAGES.DIR_LIST_ERROR(message)
  }
}

// ─── Internal Implementation Helpers ────────────────────────────────────

async function getFileTree(
  dirPath: string,
  depth: number = 10,
  currentDepth: number = 0,
): Promise<string> {
  if (currentDepth > depth) return ''
  const expanded = expandHome(dirPath)
  let output = ''
  try {
    const files = await readdir(expanded)
    for (const file of files) {
      if (IGNORED_DIRS.has(file.name)) continue
      const indent = '  '.repeat(currentDepth)
      output += `${indent}${file.isDirectory() ? '📁' : '📄'} ${file.name}\n`
      if (file.isDirectory()) {
        output += await getFileTree(
          path.join(expanded, file.name),
          depth,
          currentDepth + 1,
        )
      }
    }
  } catch (_e) {}
  return output
}

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'out'])

async function grepSearch(
  folderPath: string,
  pattern: string,
): Promise<string[]> {
  const expandedFolder = expandHome(folderPath)
  const results: string[] = []
  const regex = new RegExp(pattern, 'i')

  const walk = async (dir: string) => {
    const files = await readdir(dir)
    for (const file of files) {
      const res = path.resolve(dir, file.name)
      if (file.isDirectory()) {
        if (IGNORED_DIRS.has(file.name)) continue
        await walk(res)
      } else {
        const ext = path.extname(file.name).toLowerCase()
        if (
          [
            '.ts',
            '.tsx',
            '.js',
            '.jsx',
            '.json',
            '.md',
            '.txt',
            '.html',
            '.css',
            '.scss',
          ].includes(ext)
        ) {
          try {
            const content = await readText(res)
            if (regex.test(content)) {
              const lines = content.split('\n')
              lines.forEach((line, i) => {
                if (regex.test(line)) {
                  results.push(
                    `${path.relative(expandedFolder, res)}:${i + 1}: ${line.trim()}`,
                  )
                }
              })
            }
          } catch (_e) {}
        }
      }
    }
  }

  await walk(expandedFolder)
  return results
}
