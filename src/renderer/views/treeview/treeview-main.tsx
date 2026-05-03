import React from 'react'
import ReactDOM from 'react-dom/client'
import { Treeview } from './Treeview'
import { SidebarMockProvider } from '../../shared/context/SidebarMockContext'
import { TreeviewMockData } from './TreeviewMock'
import '../../shared/styles/index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <SidebarMockProvider value={TreeviewMockData}>
      <div className="h-screen w-screen overflow-hidden">
        <Treeview />
      </div>
    </SidebarMockProvider>
  </React.StrictMode>
)
