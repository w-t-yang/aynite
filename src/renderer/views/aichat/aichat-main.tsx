import React from 'react'
import ReactDOM from 'react-dom/client'
import { AIChat } from './AIChat'
import '../../shared/styles/index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <div className="h-screen w-screen overflow-hidden">
      <AIChat />
    </div>
  </React.StrictMode>
)
