/**
 * Shared i18n translation dictionary for the main renderer.
 *
 * Views have their own translations in their config.json `i18n` fields.
 * This file is for strings in the main renderer shell (TitleBar, contexts, etc.).
 *
 * Key naming convention: `section.key` for namespaced access.
 * Values are simple string maps: en and zh.
 */

export const translations: Record<string, { en: string; zh: string }> = {
  // Theme
  'theme.label': { en: 'Theme', zh: '主题' },

  // Language
  'language.label': { en: 'Language', zh: '语言' },
  'language.en': { en: 'English', zh: '英文' },
  'language.zh': { en: 'Chinese', zh: '中文' },

  // TitleBar items
  'titlebar.settings': { en: 'Settings', zh: '设置' },
  'titlebar.newWindow': { en: 'New Window', zh: '新窗口' },
  'titlebar.showTileControls': { en: 'Show Tile Controls', zh: '显示面板控制' },
  'titlebar.toggleInspector': { en: 'Toggle Inspector', zh: '切换检查器' },
  'titlebar.workspaces': { en: 'Workspaces', zh: '工作区' },
  'titlebar.newWorkspace': { en: 'New Workspace', zh: '新建工作区' },
  'titlebar.deleteWorkspace': { en: 'Delete Workspace', zh: '删除工作区' },
  'titlebar.addLayout': { en: 'Add Layout', zh: '添加布局' },
  'titlebar.removeCurrent': { en: 'Remove Current', zh: '移除当前' },
  'titlebar.layouts': { en: 'Layouts', zh: '布局' },
  'titlebar.minimize': { en: 'Minimize', zh: '最小化' },
  'titlebar.maximize': { en: 'Maximize', zh: '最大化' },
  'titlebar.restore': { en: 'Restore', zh: '还原' },
  'titlebar.close': { en: 'Close', zh: '关闭' },
  'titlebar.appOptions': { en: 'App Options', zh: '应用选项' },

  // Workspace modal
  'workspace.createTitle': { en: 'Create New Workspace', zh: '创建新工作区' },
  'workspace.nameLabel': { en: 'Workspace Name', zh: '工作区名称' },
  'workspace.namePlaceholder': { en: 'e.g. My Project', zh: '例如：我的项目' },
  'workspace.deleteTitle': { en: 'Delete Workspace', zh: '删除工作区' },
  'workspace.deleteConfirm': {
    en: 'Are you sure you want to delete workspace',
    zh: '确定要删除工作区',
  },
  'workspace.deleteUndo': {
    en: 'This action cannot be undone.',
    zh: '此操作无法撤销。',
  },
  'workspace.cancel': { en: 'Cancel', zh: '取消' },
  'workspace.delete': { en: 'Delete', zh: '删除' },
}
