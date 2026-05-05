import type React from 'react'
import type { FileInfo } from '../../lib/file-handlers'
import { UnifiedViewer } from './UnifiedViewer'

export const HtmlViewer: React.FC<{ file: FileInfo; content?: string }> = ({
  file,
  content,
}) => {
  const dirPath = file.path.substring(0, file.path.lastIndexOf('/'))

  if (!content) return null

  // Prepare theme styles
  const rootStyle = getComputedStyle(document.documentElement)
  const themeVars = [
    '--background',
    '--foreground',
    '--sidebar',
    '--border',
    '--primary',
    '--accent',
    '--muted',
    '--muted-foreground',
    '--info',
    '--success',
    '--warning',
  ]
    .map((v) => `${v}: ${rootStyle.getPropertyValue(v)};`)
    .join('')

  const inject = `
    <base href="aynite-resource://${dirPath}/">
    <style>
      :root { ${themeVars} }
      html, body { 
        background-color: var(--background, #09090b) !important; 
        color: var(--foreground, #fafafa) !important;
      }
    </style>
  `

  // Inject into <head> or at the beginning
  let finalContent = content
  if (finalContent.includes('<head>')) {
    finalContent = finalContent.replace('<head>', `<head>${inject}`)
  } else if (finalContent.includes('<html>')) {
    finalContent = finalContent.replace(
      '<html>',
      `<html><head>${inject}</head>`,
    )
  } else {
    finalContent = `<!DOCTYPE html><html><head>${inject}</head><body>${finalContent}</body></html>`
  }

  return <UnifiedViewer srcDoc={finalContent} padding="p-0" />
}
