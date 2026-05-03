import React from 'react'
import ReactDOM from 'react-dom/client'
import { Settings } from './Settings'
import { MockViewProvider } from '../../shared/context/MockViewContext'
import '../../shared/styles/index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <MockViewProvider>
      <div className="h-screen w-screen overflow-hidden">
        <Settings />
      </div>
    </MockViewProvider>
  </React.StrictMode>
)
