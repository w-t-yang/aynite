import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { ERROR_MESSAGES } from './constants/messages';

const AYNITE_DIR = path.join(homedir(), '.aynite-desktop');

export const AYNITE_SUBDIRS = {
  CONFIG: 'config',
  LOGS: 'logs',
  PROMPTS: 'prompts',
  THEMES: 'themes',
  SKILLS: 'skills',
  COMMANDS: 'commands',
  VIEWS: 'views',
  WORKSPACES: 'workspaces',
  SESSIONS: 'sessions'
};

/**
 * Ensures the aynite directory and its subdirectories exist.
 */
export async function initAppFolders() {
  await ensureDir(AYNITE_DIR);
  for (const subdir of Object.values(AYNITE_SUBDIRS)) {
    await ensureDir(path.join(AYNITE_DIR, subdir));
  }
}

export function getAyniteDir() {
  return AYNITE_DIR;
}

export function getAynitePath(...parts: string[]) {
  return path.join(AYNITE_DIR, ...parts);
}

export function getAyniteConfigDir() {
  return path.join(AYNITE_DIR, AYNITE_SUBDIRS.CONFIG);
}

export function getAyniteLogsDir() {
  return path.join(AYNITE_DIR, AYNITE_SUBDIRS.LOGS);
}

export function getLogPath(filename: string) {
  return path.join(getAyniteLogsDir(), filename);
}

export function getAyniteSessionsDir() {
  return path.join(AYNITE_DIR, AYNITE_SUBDIRS.SESSIONS);
}

export function getSessionPath(sessionId: string, date: string) {
  return path.join(getAyniteSessionsDir(), date, `${sessionId}.json`);
}

export function getSessionsDateDir(date: string) {
  return path.join(getAyniteSessionsDir(), date);
}

export function getAynitePromptsDir() {
  return path.join(AYNITE_DIR, AYNITE_SUBDIRS.PROMPTS);
}

export function getAynitePromptPath(filename: string) {
  return path.join(AYNITE_DIR, AYNITE_SUBDIRS.PROMPTS, filename);
}

export function getMainConfigPath() {
  return path.join(getAyniteConfigDir(), 'config.json');
}

/**
 * Checks if a target path is within a set of allowed domain folders.
 */
export function isPathWithinDomain(targetPath: string, domainFolders: string[]): boolean {
  if (!targetPath) return false;
  const resolvedTarget = path.resolve(expandHome(targetPath));
  return domainFolders.some((folder) => {
    const resolvedFolder = path.resolve(expandHome(folder));
    return resolvedTarget.startsWith(resolvedFolder);
  });
}

export function expandHome(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(homedir(), filePath.slice(1));
  }
  return filePath;
}

// --- I/O Helpers ---

export async function exists(filePath: string): Promise<boolean> {
  return existsSync(expandHome(filePath));
}

export async function ensureDir(dirPath: string) {
  await fs.mkdir(expandHome(dirPath), { recursive: true });
}

export async function readJson<T = any>(filePath: string, fallback?: T): Promise<T> {
  try {
    const data = await fs.readFile(expandHome(filePath), 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    if (fallback !== undefined) return fallback;
    throw e;
  }
}

export async function writeJson(filePath: string, data: any) {
  const expanded = expandHome(filePath);
  await ensureDir(path.dirname(expanded));
  await fs.writeFile(expanded, JSON.stringify(data, null, 2), 'utf-8');
}

export async function readText(filePath: string): Promise<string> {
  return await fs.readFile(expandHome(filePath), 'utf-8');
}

export async function writeText(filePath: string, content: string) {
  const expanded = expandHome(filePath);
  await ensureDir(path.dirname(expanded));
  await fs.writeFile(expanded, content, 'utf-8');
}

export async function appendText(filePath: string, content: string) {
  const expanded = expandHome(filePath);
  await ensureDir(path.dirname(expanded));
  await fs.appendFile(expanded, content, 'utf-8');
}

export async function readdir(dirPath: string) {
  return await fs.readdir(expandHome(dirPath), { withFileTypes: true });
}

export async function stat(filePath: string) {
  return await fs.stat(expandHome(filePath));
}

export async function unlink(filePath: string) {
  return await fs.unlink(expandHome(filePath));
}

export async function copy(src: string, dest: string, options?: { recursive?: boolean }) {
  const expandedSrc = expandHome(src);
  const expandedDest = expandHome(dest);
  await ensureDir(path.dirname(expandedDest));
  return await fs.cp(expandedSrc, expandedDest, options);
}

// --- Secure Helpers (with Domain Validation) ---

export async function secureReadText(filePath: string, domainFolders: string[]): Promise<string> {
  if (!isPathWithinDomain(filePath, domainFolders)) {
    return ERROR_MESSAGES.ACCESS_DENIED(filePath);
  }
  try {
    return await readText(filePath);
  } catch (e: any) {
    return ERROR_MESSAGES.FILE_READ_ERROR(e.message);
  }
}

export async function secureWriteText(filePath: string, content: string, domainFolders: string[]): Promise<string> {
  if (!isPathWithinDomain(filePath, domainFolders)) {
    return ERROR_MESSAGES.ACCESS_DENIED(filePath);
  }
  try {
    await writeText(filePath, content);
    return ERROR_MESSAGES.FILE_WRITE_SUCCESS(filePath);
  } catch (e: any) {
    return ERROR_MESSAGES.FILE_WRITE_ERROR(e.message);
  }
}

export async function secureListDir(dirPath: string, domainFolders: string[]): Promise<string> {
  if (!isPathWithinDomain(dirPath, domainFolders)) {
    return ERROR_MESSAGES.ACCESS_DENIED(dirPath);
  }
  try {
    const files = await readdir(dirPath);
    const entries = files.map((f) => `${f.isDirectory() ? '📁' : '📄'} ${f.name}`);
    return entries.join('\n') || ERROR_MESSAGES.DIR_EMPTY;
  } catch (e: any) {
    return ERROR_MESSAGES.DIR_LIST_ERROR(e.message);
  }
}

export async function secureGetFileTree(dirPath: string, domainFolders: string[], depth: number = 10): Promise<string> {
  if (!isPathWithinDomain(dirPath, domainFolders)) {
    return ERROR_MESSAGES.ACCESS_DENIED(dirPath);
  }
  const tree = await getFileTree(dirPath, depth);
  return tree || ERROR_MESSAGES.DIR_EMPTY;
}

export async function secureGrepSearch(folderPath: string, pattern: string, domainFolders: string[]): Promise<string> {
  if (!isPathWithinDomain(folderPath, domainFolders)) {
    return ERROR_MESSAGES.ACCESS_DENIED(folderPath);
  }
  const results = await grepSearch(folderPath, pattern);
  return results.slice(0, 50).join('\n') || ERROR_MESSAGES.NO_MATCHES_FOUND;
}

// --- Internal Implementation Helpers ---

async function getFileTree(dirPath: string, depth: number = 10, currentDepth: number = 0): Promise<string> {
  if (currentDepth > depth) return '';
  const expanded = expandHome(dirPath);
  let output = '';
  try {
    const files = await readdir(expanded);
    for (const file of files) {
      if (file.name === 'node_modules' || file.name === '.git') continue;
      const indent = '  '.repeat(currentDepth);
      output += `${indent}${file.isDirectory() ? '📁' : '📄'} ${file.name}\n`;
      if (file.isDirectory()) {
        output += await getFileTree(path.join(expanded, file.name), depth, currentDepth + 1);
      }
    }
  } catch (e) {}
  return output;
}

async function grepSearch(folderPath: string, pattern: string): Promise<string[]> {
  const expandedFolder = expandHome(folderPath);
  const results: string[] = [];
  const regex = new RegExp(pattern, 'i');

  const walk = async (dir: string) => {
    const files = await readdir(dir);
    for (const file of files) {
      const res = path.resolve(dir, file.name);
      if (file.isDirectory()) {
        if (file.name === 'node_modules' || file.name === '.git') continue;
        await walk(res);
      } else {
        const ext = path.extname(file.name).toLowerCase();
        if (['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.html', '.css', '.scss'].includes(ext)) {
          try {
            const content = await readText(res);
            if (regex.test(content)) {
              const lines = content.split('\n');
              lines.forEach((line, i) => {
                if (regex.test(line)) {
                  results.push(`${path.relative(expandedFolder, res)}:${i + 1}: ${line.trim()}`);
                }
              });
            }
          } catch (e) {}
        }
      }
    }
  };

  await walk(expandedFolder);
  return results;
}
