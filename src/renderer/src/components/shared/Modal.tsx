import React, { useEffect } from 'react'

interface ModalProps {
  children: React.ReactNode
  onClose: () => void
  title?: string
  width?: string
}

const Modal: React.FC<ModalProps> = ({ children, onClose, title, width = 'w-[320px]' }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/60 backdrop-blur-[4px] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`bg-popover border border-border rounded-2xl shadow-2xl ${width} overflow-hidden animate-in zoom-in-95 duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="px-5 py-4 border-b border-border bg-muted/50 flex items-center justify-between">
            <h3 className="text-[11px] font-black text-accent tracking-[0.1em] uppercase">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 12 12">
                <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" />
                <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-2 overflow-hidden">{children}</div>
      </div>
    </div>
  )
}

export default Modal
