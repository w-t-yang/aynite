/**
 * File operation tools: read, write, edit, list, search.
 *
 * These are thin wrappers around the secure helpers in src/lib/path/operations.ts.
 * Each tool takes a `domains` array for path validation.
 */

import { jsonSchema } from '@ai-sdk/provider-utils'
import { TOOL_METADATA } from '../../../lib/constants/ai'
import { ERROR_MESSAGES } from '../../../lib/constants/messages'
import {
  secureEditFile,
  secureGetFileTree,
  secureGlobSearch,
  secureGrepSearch,
  secureListDir,
  secureReadText,
  secureWriteText,
} from '../../../lib/path'

export function createFileOps(domains: string[], workspaceFolders: string[]) {
  return {
    read_file: {
      description: TOOL_METADATA.read_file.description,
      inputSchema: jsonSchema(TOOL_METADATA.read_file.inputSchema),
      execute: async ({ path: filePath }: { path: string }) => {
        return await secureReadText(filePath, domains)
      },
    },
    write_file: {
      description: TOOL_METADATA.write_file.description,
      inputSchema: jsonSchema(TOOL_METADATA.write_file.inputSchema),
      execute: async ({
        path: filePath,
        content,
      }: {
        path: string
        content: string
      }) => {
        return await secureWriteText(filePath, content, domains)
      },
    },
    edit_file: {
      description: TOOL_METADATA.edit_file.description,
      inputSchema: jsonSchema(TOOL_METADATA.edit_file.inputSchema),
      execute: async ({
        path: filePath,
        targetContent,
        replacementContent,
      }: {
        path: string
        targetContent: string
        replacementContent: string
      }) => {
        return await secureEditFile(
          filePath,
          targetContent,
          replacementContent,
          domains,
        )
      },
    },
    list_files: {
      description: TOOL_METADATA.list_files.description,
      inputSchema: jsonSchema(TOOL_METADATA.list_files.inputSchema),
      execute: async ({ path: dirPath }: { path: string }) => {
        return await secureListDir(dirPath, domains)
      },
    },
    grep_search: {
      description: TOOL_METADATA.grep_search.description,
      inputSchema: jsonSchema(TOOL_METADATA.grep_search.inputSchema),
      execute: async ({
        pattern,
        folderPath,
      }: {
        pattern: string
        folderPath: string
      }) => {
        return await secureGrepSearch(folderPath, pattern, domains)
      },
    },
    glob_search: {
      description: TOOL_METADATA.glob_search.description,
      inputSchema: jsonSchema(TOOL_METADATA.glob_search.inputSchema),
      execute: async ({ pattern, cwd }: { pattern: string; cwd?: string }) => {
        return await secureGlobSearch(pattern, domains, cwd)
      },
    },
    get_file_tree: {
      description: TOOL_METADATA.get_file_tree.description,
      inputSchema: jsonSchema(TOOL_METADATA.get_file_tree.inputSchema),
      execute: async ({
        path: dirPath,
        depth = 10,
      }: {
        path?: string
        depth?: number
      }) => {
        if (dirPath) {
          return await secureGetFileTree(dirPath, domains, depth)
        }
        let fullOutput = ''
        for (const folder of workspaceFolders) {
          fullOutput += `Workspace Folder: ${folder}\n`
          fullOutput += await secureGetFileTree(folder, domains, depth)
          fullOutput += '\n'
        }
        return fullOutput || ERROR_MESSAGES.WORKSPACE_EMPTY
      },
    },
  }
}
