import React from 'react';
import { createPortal } from 'react-dom';

/**
 * UnifiedViewer provides a consistent iframe container for all file types.
 * It ensures background, scrollbars, and theme alignment are identical.
 */
export const UnifiedViewer: React.FC<{ 
  children?: React.ReactNode; 
  className?: string; 
  basePath?: string;
  padding?: string;
  src?: string;
  srcDoc?: string;
}> = ({ children, className, basePath, padding = 'p-0', src, srcDoc }) => {
  const [contentRef, setContentRef] = React.useState<HTMLIFrameElement | null>(null);
  const [ready, setReady] = React.useState(false);

  const injectStyles = React.useCallback((doc: Document) => {
    const head = doc.head;
    const body = doc.body;

    if (!head || !body) return;

    // Set base URL for relative assets
    if (basePath && !src) {
      const existingBase = head.querySelector('base');
      if (existingBase) head.removeChild(existingBase);
      const base = doc.createElement('base');
      base.href = `aynite-resource://${basePath}/`;
      head.appendChild(base);
    }

    // Copy theme variables
    const rootStyle = getComputedStyle(document.documentElement);
    const variables = [
      '--background', '--foreground', '--sidebar', '--card', '--card-foreground',
      '--popover', '--popover-foreground', '--primary', '--primary-foreground',
      '--secondary', '--secondary-foreground', '--muted', '--muted-foreground',
      '--accent', '--accent-foreground', '--destructive', '--destructive-foreground',
      '--border', '--input', '--ring', '--selection', '--selection-foreground',
      '--link', '--success', '--success-foreground', '--warning', '--warning-foreground',
      '--info', '--info-foreground', '--tab-active', '--tab-active-border',
      '--scrollbar-thumb', '--scrollbar-track', '--radius'
    ];
    
    const varStyle = doc.createElement('style');
    let varRules = ':root {';
    variables.forEach(v => {
      const val = rootStyle.getPropertyValue(v);
      if (val) varRules += `${v}: ${val};`;
    });
    varRules += '}';
    varStyle.appendChild(doc.createTextNode(varRules));
    head.appendChild(varStyle);

    // Copy app styles
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        const newStyle = doc.createElement('style');
        const rules = Array.from(sheet.cssRules).map(rule => rule.cssText).join('');
        newStyle.appendChild(doc.createTextNode(rules));
        head.appendChild(newStyle);
      } catch (e) { }
    });
    
    // Inject unified global styles
    const extraStyles = doc.createElement('style');
    extraStyles.appendChild(doc.createTextNode(`
      html, body {
        background-color: var(--background) !important;
        color: var(--foreground) !important;
        margin: 0;
        padding: 0;
        height: 100%;
        width: 100%;
      }
      #unified-content {
        height: 100%;
        width: 100%;
        overflow: auto;
        box-sizing: border-box;
      }
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-track { background: var(--scrollbar-track); }
      ::-webkit-scrollbar-thumb { 
        background: var(--scrollbar-thumb); 
        border: 2px solid var(--scrollbar-track); 
        border-radius: 10px; 
      }
      ::-webkit-scrollbar-thumb:hover { background: var(--muted-foreground); }
    `));
    // Forward key events to parent
    const handleKeyDown = (e: KeyboardEvent) => {
      const event = new KeyboardEvent('keydown', {
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
        bubbles: true
      });
      window.parent.dispatchEvent(event);
    };
    doc.addEventListener('keydown', handleKeyDown);

    body.classList.add('bg-background', 'text-foreground', 'outline-none');
    body.tabIndex = 0; // Make body focusable
    body.classList.add('bg-background', 'text-foreground');
  }, [basePath, src]);

  const handleLoad = React.useCallback(() => {
    if (!contentRef) return;
    const doc = contentRef.contentWindow?.document;
    if (!doc) return;

    try {
      // Forward key events to the top window for central handling
      const handleKeyDown = (e: KeyboardEvent) => {
        const event = new KeyboardEvent('keydown', {
          key: e.key, code: e.code, ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey,
          bubbles: true, cancelable: true, composed: true
        });
        window.top?.dispatchEvent(event);
      };
      doc.removeEventListener('keydown', handleKeyDown);
      doc.addEventListener('keydown', handleKeyDown);

      // Make body focusable
      if (doc.body) {
        doc.body.tabIndex = 0;
        doc.body.style.outline = 'none';
        doc.body.focus();
      }

      // 3. Inject styles (only for portal-based)
      if (!src && !srcDoc) {
        injectStyles(doc);
        setReady(true);
      } else {
        setReady(true);
      }
    } catch (e) {
      console.warn('UnifiedViewer: Could not access iframe document:', e);
      setReady(true); // Still show it even if we can't bridge keys
    }
  }, [contentRef, src, srcDoc, injectStyles]);

  React.useEffect(() => {
    // If src or srcDoc changes, we might need to re-attach or re-check
    if (contentRef && (src || srcDoc)) {
      handleLoad();
    }
  }, [contentRef, src, srcDoc, handleLoad]);

  return (
    <iframe 
      ref={setContentRef} 
      src={src}
      srcDoc={srcDoc}
      onLoad={handleLoad}
      className={`w-full h-full border-none ${className}`} 
      title="File Viewer"
    >
      {ready && !src && !srcDoc && contentRef?.contentWindow?.document?.body && createPortal(
        <div id="unified-content" className={padding}>
          {children}
        </div>, 
        contentRef.contentWindow.document.body
      )}
    </iframe>
  );
};
