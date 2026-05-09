import { useApp } from '../../src/AppContext'
import { Modal } from '../basic/Modal'

export function SettingsModal() {
  const { showSettings, settingsTab, setShowSettings } = useApp()

  return (
    <Modal
      isOpen={showSettings}
      onClose={() => setShowSettings(false)}
      title="Settings"
      size="max"
      className="h-[90vh]"
      contentClassName="p-0"
    >
      <div className="w-full h-full bg-background rounded-b-2xl overflow-hidden">
        <iframe
          src={`aynite://settings/index.html${settingsTab ? `#tab=${settingsTab}` : ''}`}
          className="w-full h-full border-none"
          title="Settings"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </Modal>
  )
}
