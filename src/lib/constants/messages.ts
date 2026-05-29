export const ERROR_MESSAGES = {
  ACCESS_DENIED: (path: string) =>
    `Error: Access denied. Path "${path}" is not within the allowed domain.`,
  FILE_READ_ERROR: (msg: string) => `Error reading file: ${msg}`,
  FILE_NOT_TEXT: (path: string) =>
    `Error: "${path}" is not a text file. Reading binary files would corrupt the AI context. Use other approaches (like grep_search or glob_search) instead.`,
  FILE_TOO_LARGE: (path: string, size: number) =>
    `Error: File "${path}" is ${size.toLocaleString()} characters. Reading large files will overflow the AI context window. Consider using grep_search, glob_search, or other approaches instead of loading the full content.`,
  FILE_WRITE_SUCCESS: (path: string) => `Successfully wrote to ${path}`,
  FILE_WRITE_ERROR: (msg: string) => `Error writing file: ${msg}`,
  DIR_LIST_ERROR: (msg: string) => `Error listing files: ${msg}`,
  DIR_EMPTY: '(empty directory)',
  COMMAND_REJECTED: 'Command rejected by user.',
  COMMAND_EXEC_ERROR: (msg: string, stdout: string, stderr: string) =>
    `Execution Error:\n${msg}\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`,
  NO_MATCHES_FOUND: 'No matches found.',
  GREP_RESULT_TOO_LARGE: (limit: number) =>
    `Error: Search returned more than ${limit} results. Please narrow your search pattern or specify a more specific folder path.`,
  GREP_RESULT_TOO_LARGE_SIZE: (size: number) =>
    `Error: Search results exceeded ${(size / 1000).toLocaleString()}k characters. The individual matching lines are too long — they would overflow the AI context window. Please narrow your search pattern or specify a more specific folder path.`,
  URL_FETCH_ERROR: (status: string) => `Error fetching URL: ${status}`,
  URL_GENERIC_ERROR: (msg: string) => `Error: ${msg}`,
  WORKSPACE_EMPTY: '(empty workspace)',
  FILE_EDIT_SUCCESS: (path: string) => `Successfully edited ${path}`,
  FILE_EDIT_ERROR: (msg: string) => `Error editing file: ${msg}`,
  FILE_EDIT_NOT_UNIQUE: (count: number) =>
    `Error: Expected exactly one match for the target content, but found ${count}.`,
}
