export const DEFAULT_KEYBINDINGS = {
  global: {
    refresh: 'CTRL+SHIFT+R',
    quit: 'CTRL+Q'
  },
  explorer: {
    toggleLeftPanel: 'CTRL+T'
  },
  agent: {
    focusChat: 'CTRL+I',
    toggleRightPanel: 'CTRL+U'
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
    generic: { // Previously contentKeys
      exitEdit: 'ESCAPE',
      endOfLine: 'CTRL+E',
      startOfLine: 'CTRL+A',
      killLine: 'CTRL+K',
      selectAll: 'CTRL+Z',
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
