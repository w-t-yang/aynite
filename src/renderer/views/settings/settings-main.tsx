import React from 'react'
import ReactDOM from 'react-dom/client'
import { SettingsPage } from '../../shared/pages/settings/SettingsPage'
import { MockViewProvider } from '../context/MockViewContext'
import '../../shared/styles/index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <MockViewProvider>
      <div className="h-screen w-screen overflow-hidden">
        <SettingsPage />
      </div>
    </MockViewProvider>
  </React.StrictMode>
)
