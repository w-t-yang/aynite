import React from 'react'
import { createPortal } from 'react-dom'
import { useView } from '../../../views/ViewContext'

/**
 * UnifiedViewer provides a consistent iframe container for all file types.
 * It ensures background, scrollbars, and theme alignment are identical.
 *
 * Note: Theme variables are handled by ViewContext inside the iframe.
 */
export const UnifiedViewer: React.FC<{
  children?: React.ReactNode
  className?: string
  padding?: string
  src?: string
  srcDoc?: string
}> = ({ children, className, padding = 'p-0', src, srcDoc }) => {
  const [contentRef, setContentRef] = React.useState<HTMLIFrameElement | null>(
    null,
  )
  const [ready, setReady] = React.useState(false)

  // Keep track of documents we've already attached listeners to
  const initializedDocs = React.useMemo(() => new WeakSet<Document>(), [])

  const attachListeners = React.useCallback(
    (doc: Document) => {
      if (!doc.body || initializedDocs.has(doc)) return
      initializedDocs.add(doc)

      const body = doc.body
      body.tabIndex = 0
      body.style.outline = 'none'

      const handleKeyDown = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase()
        const isCmd = e.ctrlKey || e.metaKey
        const ideCommands = ['a', '/', 'j', 'k', 'h', 'l', 'w', 'r']
        const isCommandKey =
          isCmd && ['r', 's', 'w', 'p', 'i', 'u', 't', '/', '.'].includes(key)
        if (
          (!isCmd && !e.altKey && ideCommands.includes(key)) ||
          isCommandKey
        ) {
          e.preventDefault()
        }
        const event = new KeyboardEvent('keydown', {
          key: e.key,
          code: e.code,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
          bubbles: true,
          cancelable: true,
          composed: true,
        })
        try {
          window.top?.dispatchEvent(event)
        } catch (_err) {}
      }

      const handleLinkClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        const anchor = target.closest('a')
        if (anchor?.href) {
          const url = anchor.href
          const isExternal = url.startsWith('http')
          const isInternal =
            url.startsWith('aynite-resource://') ||
            url.startsWith('file://') ||
            !url.includes('://')

          if (isExternal || isInternal) {
            e.preventDefault()
            e.stopPropagation()

            if (isExternal) {
              window.aynite?.openExternal(url)
            } else {
              let cleanPath = url
              if (url.startsWith('aynite-resource://')) {
                cleanPath = decodeURIComponent(
                  url.substring('aynite-resource://'.length),
                )
              } else if (url.startsWith('file://')) {
                try {
                  cleanPath = decodeURIComponent(new URL(url).pathname)
                } catch (_e) {
                  cleanPath = decodeURIComponent(
                    url.substring('file://'.length),
                  )
                }
              }
              const isWin = navigator.userAgent.toLowerCase().includes('win')
              if (isWin && /^\/[a-zA-Z]:/.test(cleanPath)) {
                cleanPath = cleanPath.slice(1)
              } else if (!isWin && !cleanPath.startsWith('/')) {
                cleanPath = `/${cleanPath}`
              }
              console.log('[UnifiedViewer] Opening internal link:', cleanPath)
              window.aynite?.openFile(cleanPath)
            }
          }
        }
      }

      body.addEventListener('keydown', handleKeyDown, true)
      body.addEventListener('click', handleLinkClick, true)
      if (!src && !srcDoc) body.focus()
    },
    [src, srcDoc, initializedDocs],
  )

  // biome-ignore lint/correctness/noUnusedVariables: Used as a trigger for useEffect
  const { activeThemeId } = useView()

  const syncStyles = React.useCallback((doc: Document) => {
    // Clear previous styles to avoid duplication and conflicts
    const existingStyles = Array.from(
      doc.head.querySelectorAll('link[rel="stylesheet"], style'),
    )
    for (const style of existingStyles) {
      style.remove()
    }

    // Sync stylesheets from parent to iframe
    const parentStyles = Array.from(
      window.document.querySelectorAll('link[rel="stylesheet"], style'),
    )
    for (const style of parentStyles) {
      doc.head.appendChild(style.cloneNode(true))
    }

    // Sync theme variables (colors, fonts)
    const rootStyle = window.getComputedStyle(window.document.documentElement)
    const vars = Array.from(rootStyle).filter((prop) => prop.startsWith('--'))
    for (const prop of vars) {
      doc.documentElement.style.setProperty(
        prop,
        rootStyle.getPropertyValue(prop),
      )
    }

    // Sync dark mode class and data-theme
    doc.documentElement.className = window.document.documentElement.className
    const themeAttr = window.document.documentElement.getAttribute('data-theme')
    if (themeAttr) doc.documentElement.setAttribute('data-theme', themeAttr)

    // Force scrollability on iframe body
    doc.body.style.overflow = 'auto'
    doc.body.style.height = 'auto'
    doc.body.style.minHeight = '100%'
  }, [])

  // Re-sync styles when theme actually changes in the parent
  React.useEffect(() => {
    const doc =
      contentRef?.contentDocument || contentRef?.contentWindow?.document
    if (doc && ready) {
      // Small delay to ensure parent styles have been applied
      const timer = setTimeout(() => syncStyles(doc), 50)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [contentRef, syncStyles, ready])

  const handleLoad = React.useCallback(() => {
    if (!contentRef) return
    let doc: Document | null = null
    try {
      doc =
        contentRef.contentDocument || contentRef.contentWindow?.document || null
    } catch (e) {
      console.warn('UnifiedViewer: Access denied to iframe document:', e)
      setReady(true)
      return
    }
    if (!doc) return

    try {
      syncStyles(doc)
      attachListeners(doc)
      setReady(true)
    } catch (_e) {
      setReady(true)
    }
  }, [contentRef, attachListeners, syncStyles])

  React.useEffect(() => {
    if (contentRef) handleLoad()
  }, [contentRef, handleLoad])

  return (
    <iframe
      ref={setContentRef}
      src={src}
      srcDoc={srcDoc}
      onLoad={handleLoad}
      className={`w-full h-full border-none ${className}`}
      title="File Viewer"
    >
      {ready &&
        !src &&
        !srcDoc &&
        contentRef?.contentWindow?.document?.body &&
        createPortal(
          <div id="unified-content" className={padding}>
            {children}
          </div>,
          contentRef.contentWindow.document.body,
        )}
    </iframe>
  )
}
