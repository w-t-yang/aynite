import type { FileInfo } from '../../shared/lib/file-handlers'

interface FileViewHtmlProps {
  file: FileInfo
  content?: string
}

export function FileViewHtml({ file, content }: FileViewHtmlProps) {
  if (!content) return null

  const dirPath = file.path.substring(0, file.path.lastIndexOf('/'))

  // Inject theme variables and base href for relative resource resolution
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
        background-color: var(--background) !important; 
        color: var(--foreground) !important;
      }
    </style>
  `

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

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <iframe
        srcDoc={finalContent}
        className="flex-1 w-full border-none"
        title="HTML Preview"
      />
    </div>
  )
}
