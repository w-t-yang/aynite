import { AppOperation, ViewOperation } from './app'

export const DEFAULT_KEYBINDINGS = {
  app: {
    [AppOperation.TILE_CYCLE]: { ctrl: true, key: 'o' },
    [AppOperation.TILE_SPLIT_VERTICAL]: { ctrl: true, key: '-' },
    [AppOperation.TILE_SPLIT_HORIZONTAL]: { ctrl: true, key: '=' },
    [AppOperation.TILE_CLOSE]: { ctrl: true, key: 'q' },
    [AppOperation.TILE_RESIZE_LEFT]: { ctrl: true, shift: true, key: 'arrowleft' },
    [AppOperation.TILE_RESIZE_RIGHT]: { ctrl: true, shift: true, key: 'arrowright' },
    [AppOperation.TILE_RESIZE_UP]: { ctrl: true, shift: true, key: 'arrowup' },
    [AppOperation.TILE_RESIZE_DOWN]: { ctrl: true, shift: true, key: 'arrowdown' },
    [AppOperation.QUIT]: { ctrl: true, shift: true, key: 'q' },


    // Global & Navigation
    [AppOperation.REFRESH_APP]: { ctrl: true, key: 'r' },
    [AppOperation.TOGGLE_LEFT_PANEL]: { ctrl: true, key: 'b' },
    [AppOperation.TOGGLE_RIGHT_PANEL]: { ctrl: true, key: 'i' },
    [AppOperation.FOCUS_CHAT]: { ctrl: true, key: 'l' },
    [AppOperation.FOCUS_SKILLS]: { ctrl: true, shift: true, key: 's' },
    [AppOperation.FOCUS_COMMANDS]: { ctrl: true, shift: true, key: 'c' },
    [AppOperation.SUBMIT_CHAT]: { key: 'enter' }
  },
  view: {
    [ViewOperation.BEGINNING_OF_LINE]: { ctrl: true, key: 'a' },
    [ViewOperation.END_OF_LINE]: { ctrl: true, key: 'e' },
    [ViewOperation.KILL_LINE]: { ctrl: true, key: 'k' },
    [ViewOperation.MARK_WHOLE_BUFFER]: { ctrl: true, key: 'q' },
    [ViewOperation.DELETE_CHAR]: { ctrl: true, key: 'd' },
    [ViewOperation.CUT]: { ctrl: true, key: 'x' },
    [ViewOperation.COPY]: { ctrl: true, key: 'c' },
    [ViewOperation.PASTE]: { ctrl: true, key: 'v' },
    [ViewOperation.PREVIOUS_LINE]: { ctrl: true, key: 'p' },
    [ViewOperation.NEXT_LINE]: { ctrl: true, key: 'n' },
    [ViewOperation.FORWARD_CHAR]: { ctrl: true, key: 'f' },
    [ViewOperation.BACKWARD_CHAR]: { ctrl: true, key: 'b' },
    [ViewOperation.KEYBOARD_QUIT]: { key: 'escape' }
  }
}
