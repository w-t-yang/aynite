import { SidebarApi, FileNode } from '../../shared/context/SidebarMockContext';

export const TreeviewMockData: SidebarApi = {
  getWorkspacesList: async () => ({
    list: ['Aynite Playbook', 'personal-project', 'experimental'],
    active: 'Aynite Playbook'

  }),
  getWorkspaceFolders: async () => ['/home/user/repos/aynite'],
  getFiles: async (dirPath: string) => {
    console.log('Mock: getFiles', dirPath);
    if (dirPath === '/home/user/repos/aynite') {
      return [
        { id: '/home/user/repos/aynite/src', name: 'src', isDirectory: true, isLoaded: false, children: [] },
        { id: '/home/user/repos/aynite/package.json', name: 'package.json', isDirectory: false },
        { id: '/home/user/repos/aynite/README.md', name: 'README.md', isDirectory: false }
      ];
    }
    if (dirPath === '/home/user/repos/aynite/src') {
      return [
        { id: '/home/user/repos/aynite/src/main', name: 'main', isDirectory: true, isLoaded: false, children: [] },
        { id: '/home/user/repos/aynite/src/renderer', name: 'renderer', isDirectory: true, isLoaded: false, children: [] },
        { id: '/home/user/repos/aynite/src/index.ts', name: 'index.ts', isDirectory: false }
      ];
    }
    return [];
  },
  createWorkspace: async (name) => { console.log('Mock: createWorkspace', name); },
  switchWorkspace: async (name) => { console.log('Mock: switchWorkspace', name); },
  addWorkspaceFolder: async () => '/home/user/repos/new-folder',
  removeWorkspaceFolder: async (path) => { console.log('Mock: removeWorkspaceFolder', path); },
  reorderWorkspaceFolders: async (paths) => { console.log('Mock: reorderWorkspaceFolders', paths); },
  createFile: async (path, isDir) => { console.log('Mock: createFile', path, isDir); },
  deleteFile: async (path) => { console.log('Mock: deleteFile', path); },
  renameFile: async (oldPath, newPath) => { console.log('Mock: renameFile', oldPath, newPath); },
  copyFile: async (src, dest) => { console.log('Mock: copyFile', src, dest); },
  joinPath: async (...parts) => parts.join('/'),
  dirname: async (path) => path.split('/').slice(0, -1).join('/'),
  onFileSystemChange: (callback) => {
    console.log('Mock: onFileSystemChange registered');
    return () => console.log('Mock: onFileSystemChange unsubscribed');
  }
};
