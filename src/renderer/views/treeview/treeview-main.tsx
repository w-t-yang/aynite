import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeAwareView } from '../../shared/lib/useTheme'
import { Treeview } from './Treeview'
import '../../shared/styles/index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeAwareView>
      <div className="h-screen w-screen overflow-hidden">
        <Treeview />
      </div>
    </ThemeAwareView>
  </React.StrictMode>,
)
