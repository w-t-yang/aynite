import React from 'react'
import ReactDOM from 'react-dom/client'
import { Settings } from './Settings'
import { ThemeAwareView } from '../../shared/lib/useTheme'
import '../../shared/styles/index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeAwareView>
      <div className="h-screen w-screen overflow-hidden">
        <Settings />
      </div>
    </ThemeAwareView>
  </React.StrictMode>
)
