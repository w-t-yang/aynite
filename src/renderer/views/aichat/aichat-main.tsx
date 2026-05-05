import React from 'react'
import ReactDOM from 'react-dom/client'
import { AIChat } from './AIChat'
import { ChatMockProvider } from '../context/ChatMockContext'
import { AIChatMockData } from './AIChatMock'
import '../../shared/styles/index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ChatMockProvider value={AIChatMockData}>
      <div className="h-screen w-screen overflow-hidden">
        <AIChat />
      </div>
    </ChatMockProvider>
  </React.StrictMode>
)
