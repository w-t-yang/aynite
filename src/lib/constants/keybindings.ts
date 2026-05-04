export const DEFAULT_KEYBINDINGS = {
  global: {
    refresh: 'CTRL+SHIFT+R',
    quit: ''
  },
  explorer: {
    toggleLeftPanel: 'CTRL+T'
  },
  agent: {
    focusChat: 'CTRL+I',
    focusSkills: 'CTRL+/',
    focusCommands: 'CTRL+.',
    toggleRightPanel: 'CTRL+U',
    submit: 'CTRL+ENTER'
  },
  content: {
    navigation: {
      switchTab: 'CTRL+TAB',
      closeTab: 'CTRL+W',
      focusContent: 'CTRL+Y'
    },
    viewer: {
      enterEdit: 'A',
      moveDown: 'J',
      moveUp: 'K',
      moveLeft: 'H',
      moveRight: 'L',
      search: '/',
      refresh: 'CTRL+R'
    },
    generic: {
      exitEdit: 'ESCAPE',
      endOfLine: 'CTRL+E',
      startOfLine: 'CTRL+A',
      killLine: 'CTRL+K',
      selectAll: 'CTRL+Q',
      deleteForward: 'CTRL+D',
      cut: 'CTRL+X',
      copy: 'CTRL+C',
      paste: 'CTRL+V',
      prevLine: 'CTRL+P',
      nextLine: 'CTRL+N',
      forwardChar: 'CTRL+F',
      backwardChar: 'CTRL+B'
    }
  }
};
