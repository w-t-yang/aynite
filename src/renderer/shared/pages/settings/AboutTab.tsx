import React from 'react';
import { Bot, CloudDownload, RefreshCw, Github, Bug } from 'lucide-react';
import { Button } from '../../basic/Button';
import { SettingsPage } from '../../basic/SettingsPage';
import { Section } from '../../basic/Section';

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

  const updateButton = (
    <div className="flex items-center gap-2">
      {(updateStatus === 'idle' || updateStatus === 'error') && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onCheckUpdates}
          className="px-4 py-1.5"
        >
          Check for Updates
        </Button>
      )}
      {updateStatus === 'checking' && (
        <Button 
          disabled 
          variant="secondary"
          size="sm"
          className="px-4 py-1.5 flex items-center gap-2"
        >
          <RefreshCw size={12} className="animate-spin" /> Checking
        </Button>
      )}
      {updateStatus === 'available' && (
        <Button 
          disabled 
          variant="primary"
          size="sm"
          className="px-4 py-1.5 bg-primary/20 text-primary"
        >
          Downloading...
        </Button>
      )}
      {updateStatus === 'downloaded' && (
        <Button
          variant="primary"
          size="sm"
          onClick={onInstallUpdate}
          className="px-4 py-1.5 shadow-lg shadow-primary/20 transition-all"
        >
          Update and Restart
        </Button>
      )}
    </div>
  );

  return (
    <SettingsPage
      title="About Aynite"
      description="Information about Aynite, system updates, and developer resources."
    >
      <div className="flex flex-col items-center text-center space-y-4 pt-4 mb-8">
        <div className="w-24 h-24 rounded-3xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/20 border-4 border-background">
          <Bot size={56} className="text-primary-foreground" />
        </div>
        <div className="space-y-1.5 text-center">
          <h3 className="text-4xl font-black tracking-tighter text-foreground">Aynite</h3>
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-bold text-primary tracking-[0.3em] uppercase">A.Y.N.I.T.E</p>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest opacity-60">All You Need Is The Editor</p>
          </div>
        </div>
        <div className="px-4 py-1.5 bg-accent/30 rounded-full border border-border/50 text-xs font-mono text-muted-foreground shadow-sm">
          Version {appVersion || '0.0.0'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <Section title="Software Update" description="Keep your application up to date with the latest features.">
          <div className="p-6 rounded-2xl border border-border bg-accent/5 flex items-center justify-between group">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <CloudDownload size={16} className="text-primary" />
                {updateStatus === 'downloaded' ? 'Update Ready' : 'Status'}
              </h4>
              <p className="text-xs text-muted-foreground">
                {updateStatus === 'idle' && 'Software is up to date.'}
                {updateStatus === 'checking' && 'Checking...'}
                {updateStatus === 'available' && `New: v${updateInfo?.version}`}
                {updateStatus === 'downloading' && 'Downloading...'}
                {updateStatus === 'downloaded' && `Ready to install.`}
                {updateStatus === 'error' && 'Check failed.'}
              </p>
            </div>
            {updateButton}
          </div>
        </Section>

        <Section title="Resources" description="Join the community and help improve the project.">
          <div className="grid grid-cols-1 gap-3">
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => onOpenExternal('https://github.com/w-t-yang/aynite')} 
              className="flex items-center justify-start gap-3 p-4 text-sm font-medium h-auto hover:bg-accent transition-all"
            >
              <Github size={18} className="text-foreground" />
              <div className="text-left">
                <div className="font-bold">GitHub Project</div>
                <div className="text-[10px] text-muted-foreground font-normal">View source code</div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => onOpenExternal('https://github.com/w-t-yang/aynite/issues')} 
              className="flex items-center justify-start gap-3 p-4 text-sm font-medium h-auto hover:bg-accent transition-all"
            >
              <Bug size={18} className="text-destructive" />
              <div className="text-left">
                <div className="font-bold">Report an Issue</div>
                <div className="text-[10px] text-muted-foreground font-normal">Submit bug reports</div>
              </div>
            </Button>
          </div>
        </Section>
      </div>

      <div className="pt-20 text-center">
        <p className="text-[10px] text-muted-foreground/30 font-mono italic tracking-widest">
          BUILT WITH ❤️ FOR THE AI LIFESTYLE
        </p>
      </div>
    </SettingsPage>
  );
}
