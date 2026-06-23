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

  // App loading
  'app.loading': { en: 'Loading Aynite...', zh: '加载中...' },

  // Update banner
  'update.available': { en: 'Update Available', zh: '有可用更新' },
  'update.downloading': { en: 'Downloading Update...', zh: '正在下载更新...' },
  'update.ready': { en: 'Update Ready', zh: '更新就绪' },
  'update.softwareUpdate': { en: 'Software Update', zh: '软件更新' },
  'update.current': { en: 'Current:', zh: '当前版本：' },
  'update.new': { en: 'New:', zh: '新版本：' },
  'update.downloaded': {
    en: 'has been downloaded.',
    zh: '已下载完成。',
  },
  'update.saveWork': {
    en: 'Save your work, then quit and install the update.',
    zh: '保存您的工作，然后退出并安装更新。',
  },
  'update.later': { en: 'Later', zh: '稍后' },
  'update.quitInstall': { en: 'Quit & Install', zh: '退出并安装' },
  'update.cancel': { en: 'Cancel', zh: '取消' },
  'update.downloadUpdate': { en: 'Download & Update', zh: '下载并更新' },
  'update.close': { en: 'Close', zh: '关闭' },
  'update.badgeReady': { en: 'Update Ready', zh: '更新就绪' },
  'update.dismiss': { en: 'Dismiss', zh: '忽略' },
  'update.unknownVersion': { en: '?', zh: '?' },

  // Sidebar
  'sidebar.home': { en: 'Home', zh: '首页' },
  'sidebar.projects': { en: 'Projects', zh: '项目' },
  'sidebar.flows': { en: 'Flows', zh: '流程' },
  'sidebar.settings': { en: 'Settings', zh: '设置' },

  // Tile
  'tile.close': { en: 'Close Tile', zh: '关闭面板' },
  'tile.loadView': { en: 'Load View', zh: '加载视图' },
  'tile.availableViews': { en: 'Available Views', zh: '可用视图' },
  'tile.shortcuts': { en: 'Tile Shortcuts', zh: '面板快捷键' },
  'tile.splitVertical': { en: 'Split vertically', zh: '垂直拆分' },
  'tile.splitHorizontal': { en: 'Split horizontally', zh: '水平拆分' },
  'tile.closeTile': { en: 'Close tile', zh: '关闭面板' },
  'tile.cycleTiles': { en: 'Cycle around tiles', zh: '循环切换面板' },
  'tile.refreshTile': { en: 'Refresh tile', zh: '刷新面板' },
  'tile.loading': { en: 'Loading', zh: '加载中' },
  'tile.options': { en: 'Tile Options', zh: '面板选项' },

  // Layout vibe modal
  'vibe.title': {
    en: 'How would you like your new layout?',
    zh: '您想要什么样的新布局？',
  },
  'vibe.chatLabel': { en: 'Chat Vibe', zh: '聊天布局' },
  'vibe.chatDesc': {
    en: 'Sessions panel with hybrid AI Chat and File Browser view.',
    zh: '会话面板，包含混合 AI 聊天和文件浏览器视图。',
  },
  'vibe.fileLabel': { en: 'File Vibe', zh: '文件布局' },
  'vibe.fileDesc': {
    en: 'A traditional file management setup with Treeview and Explorer.',
    zh: '传统的文件管理设置，包含树形视图和资源管理器。',
  },
  'vibe.codeLabel': { en: 'Code Vibe', zh: '代码布局' },
  'vibe.codeDesc': {
    en: 'The ultimate dev environment: Treeview, Files, and AI Chat.',
    zh: '终极开发环境：树形视图、文件和 AI 聊天。',
  },
  'vibe.emptyLabel': { en: 'Empty Layout', zh: '空布局' },
  'vibe.emptyDesc': {
    en: 'Start with a single empty tile, then choose a view to load.',
    zh: '从一个空白面板开始，然后选择要加载的视图。',
  },
  'vibe.cancel': { en: 'Cancel', zh: '取消' },
  'vibe.confirm': { en: 'Confirm Vibe', zh: '确认布局' },
}
