import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'w-80',
  md: 'w-[450px]',
  lg: 'w-[600px]',
  xl: 'w-[800px]'
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  className,
  size = 'md'
}: ModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className={cn(
        "relative bg-sidebar border border-border shadow-2xl rounded-2xl flex flex-col max-h-[90vh] overflow-hidden transition-all animate-in fade-in zoom-in duration-200",
        sizeClasses[size],
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/40">
          <h3 className="text-lg font-semibold text-foreground tracking-tight">{title}</h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-5 border-t border-border/40 bg-accent/5 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
