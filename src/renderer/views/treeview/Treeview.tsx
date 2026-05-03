import React from 'react';
import { TreeviewPage } from '../../shared/pages/treeview/TreeviewPage';

export function Treeview() {
  return (
    <div className="w-full h-full bg-background overflow-hidden">
      <TreeviewPage 
        onSelectFile={(file) => console.log('File selected:', file)}
        onOpenSettings={() => console.log('Open settings')}
      />
    </div>
  );
}
