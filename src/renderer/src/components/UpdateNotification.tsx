import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, AlertCircle, X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function UpdateNotification() {
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'>('idle');
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [updateProgress, setUpdateProgress] = useState<number>(0);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.api) return;

    const unsubChecking = window.api.onUpdateChecking(() => setUpdateStatus('checking'));
    const unsubAvailable = (info: any) => {
      setUpdateStatus('available');
      setUpdateInfo(info);
    };
    const offAvailable = window.api.onUpdateAvailable(unsubAvailable);
    
    const unsubNotAvailable = window.api.onUpdateNotAvailable(() => setUpdateStatus('idle'));
    const unsubError = window.api.onUpdateError((err: string) => {
      setUpdateStatus('error');
      setUpdateError(err);
    });
    const unsubProgress = (progress: any) => {
      setUpdateStatus('downloading');
      setUpdateProgress(progress.percent);
    };
    const offProgress = window.api.onUpdateProgress(unsubProgress);
    
    const unsubDownloaded = (info: any) => {
      setUpdateStatus('downloaded');
      setUpdateInfo(info);
    };
    const offDownloaded = window.api.onUpdateDownloaded(unsubDownloaded);

    return () => {
      unsubChecking?.();
      offAvailable?.();
      unsubNotAvailable?.();
      unsubError?.();
      offProgress?.();
      offDownloaded?.();
    };
  }, []);

  if (updateStatus === 'idle') return null;

  return (
    <div className="fixed bottom-4 right-4 z-[999] animate-in slide-in-from-bottom-2 fade-in">
      <div className="bg-popover border border-border shadow-2xl rounded-xl p-4 min-w-[300px] max-w-md flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            updateStatus === 'error' ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
          )}>
            {updateStatus === 'checking' && <RefreshCw size={20} className="animate-spin" />}
            {updateStatus === 'available' && <Download size={20} />}
            {updateStatus === 'downloading' && <Download size={20} className="animate-bounce" />}
            {updateStatus === 'downloaded' && <Download size={20} />}
            {updateStatus === 'error' && <AlertCircle size={20} />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground truncate">
              {updateStatus === 'checking' && 'Checking for updates...'}
              {updateStatus === 'available' && `Update available: v${updateInfo?.version}`}
              {updateStatus === 'downloading' && `Downloading update... ${Math.round(updateProgress)}%`}
              {updateStatus === 'downloaded' && `Update v${updateInfo?.version} ready`}
              {updateStatus === 'error' && 'Update error'}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {updateStatus === 'error' ? updateError : (updateStatus === 'downloaded' ? 'Restart to apply changes' : 'Aynite Release Pipeline')}
            </p>
          </div>
          <button 
            onClick={() => setUpdateStatus('idle')}
            className="p-1 hover:bg-accent rounded-md text-muted-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        
        {updateStatus === 'downloading' && (
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-primary h-full transition-all duration-300" 
              style={{ width: `${updateProgress}%` }}
            />
          </div>
        )}
        
        {updateStatus === 'downloaded' && (
          <button
            onClick={() => window.api.installUpdate()}
            className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            <RefreshCw size={14} /> Restart and Update
          </button>
        )}
      </div>
    </div>
  );
}
