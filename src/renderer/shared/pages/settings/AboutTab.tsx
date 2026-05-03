import React from 'react';
import { Bot, CloudDownload, RefreshCw, Github, Bug } from 'lucide-react';

interface AboutTabProps {
  state: {
    appVersion: string;
    updateStatus: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';
    updateInfo: any;
  };
  actions: {
    onCheckUpdates: () => void;
    onInstallUpdate: () => void;
    onOpenExternal: (url: string) => void;
  };
}

export function AboutTab({
  state,
  actions
}: AboutTabProps) {
  const { appVersion, updateStatus, updateInfo } = state;
  const { onCheckUpdates, onInstallUpdate, onOpenExternal } = actions;

  return (
    <div className="space-y-10 max-w-4xl pb-10">
      <div className="flex flex-col items-center text-center space-y-4 pt-4">
        <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/20">
          <Bot size={48} className="text-primary-foreground" />
        </div>
        <div className="space-y-1.5 text-center">
          <h3 className="text-3xl font-black tracking-tight text-foreground">Aynite</h3>
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-primary tracking-widest uppercase">A.Y.N.I.T.E</p>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">All You Need Is The Editor</p>
          </div>
        </div>
        <div className="px-3 py-1 bg-accent/30 rounded-full border border-border/50 text-[11px] font-mono text-muted-foreground">
          Version {appVersion || '0.0.0'}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 pt-4">
        <div className="p-6 rounded-2xl border border-border bg-accent/5 flex items-center justify-between group">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <CloudDownload size={16} className="text-primary" />
              Software Update
            </h4>
            <p className="text-xs text-muted-foreground">
              {updateStatus === 'idle' && 'Your software is up to date.'}
              {updateStatus === 'checking' && 'Checking for updates...'}
              {updateStatus === 'available' && `New version available: v${updateInfo?.version}`}
              {updateStatus === 'downloading' && 'Downloading update in background...'}
              {updateStatus === 'downloaded' && `Version v${updateInfo?.version} is ready to install.`}
              {updateStatus === 'error' && 'Failed to check for updates.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(updateStatus === 'idle' || updateStatus === 'error') && (
              <button
                onClick={onCheckUpdates}
                className="px-4 py-1.5 bg-accent hover:bg-accent/80 rounded-lg text-xs font-medium transition-all"
              >
                Check for Updates
              </button>
            )}
            {updateStatus === 'checking' && (
              <button disabled className="px-4 py-1.5 bg-accent/50 rounded-lg text-xs font-medium flex items-center gap-2">
                <RefreshCw size={12} className="animate-spin" /> Checking
              </button>
            )}
            {updateStatus === 'available' && (
              <button disabled className="px-4 py-1.5 bg-primary/20 text-primary rounded-lg text-xs font-medium">
                Downloading...
              </button>
            )}
            {updateStatus === 'downloaded' && (
              <button
                onClick={onInstallUpdate}
                className="px-4 py-1.5 bg-primary text-primary-foreground hover:brightness-110 rounded-lg text-xs font-medium shadow-lg shadow-primary/20 transition-all"
              >
                Update and Restart
              </button>
            )}
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-border bg-accent/5 space-y-4">
          <h4 className="text-sm font-semibold">Resources</h4>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => onOpenExternal('https://github.com/w-t-yang/aynite')} className="flex items-center gap-2 p-2 hover:bg-accent rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border">
              <Github size={14} /> GitHub Project
            </button>
            <button onClick={() => onOpenExternal('https://github.com/w-t-yang/aynite/issues')} className="flex items-center gap-2 p-2 hover:bg-accent rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border">
              <Bug size={14} /> Report an Issue
            </button>
          </div>
        </div>
      </div>

      <div className="pt-10 text-center">
        <p className="text-[10px] text-muted-foreground/50 font-mono italic">
          Built with ❤️ for the AI lifestyle
        </p>
      </div>
    </div>
  );
}
