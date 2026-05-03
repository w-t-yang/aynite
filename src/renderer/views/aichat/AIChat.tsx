import React from 'react';
import { AIChatPage } from '../../shared/pages/aichat/AIChatPage';

export function AIChat() {
  return (
    <div className="w-full h-full bg-background overflow-hidden">
      <AIChatPage 
        onOpenFile={(file, content) => console.log('Opening file:', file.path)}
      />
    </div>
  );
}
