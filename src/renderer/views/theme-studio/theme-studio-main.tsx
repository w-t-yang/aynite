import React from 'react'
import ReactDOM from 'react-dom/client'
import { ViewProvider } from '../ViewContext'
import { ThemeStudioPage } from './ThemeStudioPage'
import '../../shared/styles/index.css'

const rootElement = document.getElementById('root')
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ViewProvider>
        <ThemeStudioPage />
      </ViewProvider>
    </React.StrictMode>,
  )
}
