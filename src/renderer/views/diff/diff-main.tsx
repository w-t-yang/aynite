import React from 'react'
import ReactDOM from 'react-dom/client'
import { ViewProvider } from '../ViewContext'
import { DiffPage } from './DiffPage'
import '../../shared/styles/index.css'

const rootElement = document.getElementById('root')
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ViewProvider>
        <DiffPage />
      </ViewProvider>
    </React.StrictMode>,
  )
}
