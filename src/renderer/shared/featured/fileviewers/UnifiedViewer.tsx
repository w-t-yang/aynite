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
    head.appendChild(extraStyles);

    body.classList.add('bg-background', 'text-foreground', 'outline-none');
    body.tabIndex = 0;
  }, [basePath, src]);

  // Keep track of documents we've already attached listeners to
  const initializedDocs = React.useMemo(() => new WeakSet<Document>(), []);

  const attachListeners = React.useCallback((doc: Document) => {
    if (!doc.body || initializedDocs.has(doc)) return;
    initializedDocs.add(doc);

    const body = doc.body;
    body.tabIndex = 0;
    body.style.outline = 'none';

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isCmd = e.ctrlKey || e.metaKey;
      const ideCommands = ['a', '/', 'j', 'k', 'h', 'l', 'w', 'r'];
      const isCommandKey = (isCmd && ['r', 's', 'w', 'p', 'i', 'u', 't', '/', '.'].includes(key));
      if ((!isCmd && !e.altKey && ideCommands.includes(key)) || isCommandKey) {
        e.preventDefault();
      }
      const event = new KeyboardEvent('keydown', {
        key: e.key, code: e.code, ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey,
        bubbles: true, cancelable: true, composed: true
      });
      try { window.top?.dispatchEvent(event); } catch (err) { }
    };

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor && anchor.href) {
        const url = anchor.href;
        // Check if it's an internal link or external
        const isExternal = url.startsWith('http');
        const isInternal = url.startsWith('aynite-resource://') || url.startsWith('file://') || !url.includes('://');

        if (isExternal || isInternal) {
          e.preventDefault();
          e.stopPropagation();

          if (isExternal) {
            // @ts-ignore
            window.aynite?.openExternal(url);
          } else {
            let cleanPath = url;
            if (url.startsWith('aynite-resource://')) {
              cleanPath = decodeURIComponent(url.substring('aynite-resource://'.length));
            } else if (url.startsWith('file://')) {
              try {
                cleanPath = decodeURIComponent(new URL(url).pathname);
              } catch (e) {
                cleanPath = decodeURIComponent(url.substring('file://'.length));
              }
            }
            const isWin = navigator.userAgent.toLowerCase().includes('win');
            if (isWin && /^\/[a-zA-Z]:/.test(cleanPath)) {
              cleanPath = cleanPath.slice(1);
            } else if (!isWin && !cleanPath.startsWith('/')) {
              cleanPath = '/' + cleanPath;
            }
            console.log('[UnifiedViewer] Intercepted internal link:', cleanPath);
            window.top?.postMessage({ type: 'open-file', path: cleanPath }, '*');
            window.top?.dispatchEvent(new CustomEvent('aynite:open-file', { detail: { path: cleanPath } }));
          }
        }
      }
    };

    body.addEventListener('keydown', handleKeyDown, true);
    body.addEventListener('click', handleLinkClick, true);
    if (!src && !srcDoc) body.focus();
  }, [src, srcDoc, initializedDocs]);

  const handleLoad = React.useCallback(() => {
    if (!contentRef) return;
    let doc: Document | null = null;
    try {
      doc = contentRef.contentDocument || contentRef.contentWindow?.document || null;
    } catch (e) {
      console.warn('UnifiedViewer: Access denied to iframe document:', e);
      setReady(true);
      return;
    }
    if (!doc) return;

    try {
      if (!src && !srcDoc) injectStyles(doc);
      attachListeners(doc);
      setReady(true);
    } catch (e) {
      setReady(true);
    }
  }, [contentRef, src, srcDoc, injectStyles, attachListeners]);

  React.useEffect(() => {
    if (contentRef) handleLoad();
  }, [contentRef, handleLoad, src, srcDoc]);

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
