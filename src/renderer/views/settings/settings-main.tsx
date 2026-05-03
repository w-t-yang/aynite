import React from 'react'
import ReactDOM from 'react-dom/client'
import Settings from './Settings'
import '../../src/index.css'
import demoDefaults from './Settings.demo.json'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <div className="h-screen w-screen overflow-hidden">
      <Settings 
        settings={demoDefaults as any} 
        onSave={(s) => console.log('Save:', s)} 
        onClose={() => console.log('Close')} 
      />
    </div>
  </React.StrictMode>
)
