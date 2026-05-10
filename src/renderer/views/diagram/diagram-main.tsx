import React from 'react'
import ReactDOM from 'react-dom/client'
import { ViewProvider } from '../ViewContext'
import { DiagramPage } from './DiagramPage'
import '../../shared/styles/index.css'

const rootElement = document.getElementById('root')
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ViewProvider>
        <DiagramPage />
      </ViewProvider>
    </React.StrictMode>,
  )
}
