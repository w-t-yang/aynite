import React from 'react'
import ReactDOM from 'react-dom/client'
import { VIEW_CONTAINER } from './styles'
import { ThemeAwareView } from './useTheme'
import '../styles/index.css'

export function renderView(Component: React.ComponentType) {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <ThemeAwareView>
        <div className={VIEW_CONTAINER}>
          <Component />
        </div>
      </ThemeAwareView>
    </React.StrictMode>,
  )
}
