import React, { useState } from 'react';
import { AIChatPage } from '../../shared/pages/aichat/AIChatPage';
import { DEFAULT_SETTINGS } from '../../../lib/constants/settings';

export function AIChat() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  return (
    <div className="w-full h-full bg-background overflow-hidden">
      <AIChatPage 
        settings={settings}
        onUpdateSettings={setSettings}
        onOpenFile={(file, content) => console.log('Opening file:', file.path)}
      />
    </div>
  );
}
