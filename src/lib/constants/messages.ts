export const ERROR_MESSAGES = {
  ACCESS_DENIED: (path: string) =>
    `Error: Access denied. Path "${path}" is not within the allowed domain.`,
  FILE_READ_ERROR: (msg: string) => `Error reading file: ${msg}`,
  FILE_WRITE_SUCCESS: (path: string) => `Successfully wrote to ${path}`,
  FILE_WRITE_ERROR: (msg: string) => `Error writing file: ${msg}`,
  DIR_LIST_ERROR: (msg: string) => `Error listing files: ${msg}`,
  DIR_EMPTY: '(empty directory)',
  COMMAND_REJECTED: 'Command rejected by user.',
  COMMAND_EXEC_ERROR: (msg: string, stdout: string, stderr: string) =>
    `Execution Error:\n${msg}\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`,
  NO_MATCHES_FOUND: 'No matches found.',
  URL_FETCH_ERROR: (status: string) => `Error fetching URL: ${status}`,
  URL_GENERIC_ERROR: (msg: string) => `Error: ${msg}`,
  WORKSPACE_EMPTY: '(empty workspace)',
}
