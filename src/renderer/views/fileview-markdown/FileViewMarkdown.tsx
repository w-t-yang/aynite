import { Check, Clipboard, Info } from 'lucide-react'
import type React from 'react'
import { useCallback, useState } from 'react'
import Markdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import { Button } from '../../shared/basic/Button'
import type { FileInfo } from '../../shared/lib/file-handlers'
import { highlightCode } from '../../shared/lib/syntax'
import { cn } from '../../shared/lib/utils'

interface CodeBlockProps {
  language?: string
  value: string
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const highlightedHtml = highlightCode(value, language || 'txt') || value

  return (
    <div className="group relative my-6 overflow-hidden rounded-xl border border-border/40 bg-muted/20 shadow-lg transition-all hover:border-border/60">
      <div className="flex items-center justify-between bg-muted/40 px-4 py-2 backdrop-blur-sm">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
          {language || 'code'}
        </span>
        <Button
          variant="ghost"
          onClick={copyToClipboard}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground h-auto border-none"
        >
          {copied ? (
            <Check size={12} className="text-green-500" />
          ) : (
            <Clipboard size={12} />
          )}
          <span className="font-medium">{copied ? 'Copied' : 'Copy'}</span>
        </Button>
      </div>
      <div className="overflow-auto p-4 font-mono text-[13px] leading-relaxed">
        <pre
          className="m-0 p-0"
          style={{ fontFamily: '"Fira Code", monospace' }}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for PrismJS highlighting
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      </div>
    </div>
  )
}

/**
 * Resolve a relative or absolute path against the markdown file's directory.
 * Returns the absolute path.
 */
function resolveLocalPath(href: string, filePath: string): string {
  // If it's already an absolute path (starts with / on Unix or has drive letter on Windows)
  if (href.startsWith('/')) return href
  if (/^[A-Za-z]:\\/.test(href)) return href

  // Resolve relative to markdown file's directory
  const dir = filePath.split(/[/\\]/).slice(0, -1).join('/')
  // Normalize: handle . and ..
  const segments = href.split('/')
  const result = dir.split('/')
  for (const seg of segments) {
    if (seg === '.' || seg === '') continue
    if (seg === '..') {
      result.pop()
    } else {
      result.push(seg)
    }
  }
  return result.join('/')
}

/**
 * Check if a URL/href is a local file path (not http, https, mailto, tel, #)
 */
function isLocalPath(href: string): boolean {
  return !/^(https?:\/\/|mailto:|tel:|#|\/\/)/i.test(href)
}

export const FileViewMarkdown: React.FC<{
  file: FileInfo
  content?: string
  className?: string
}> = ({ file, content, className }) => {
  const markdown = content || ''

  // Detect if there's frontmatter to strip it from the rendered markdown if needed
  const fmMatch = markdown.match(/^---\r?\n([\s\S]+?)\r?\n---/)

  const handleLocalLink = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      if (!isLocalPath(href)) return // let external links open normally
      e.preventDefault()
      const resolvedPath = resolveLocalPath(href, file.path)
      window.aynite.setConfig('activeFile', resolvedPath)
    },
    [file.path],
  )

  return (
    <div
      className={cn(
        'h-full w-full overflow-y-auto bg-background selection:bg-primary/20 scroll-smooth',
        className,
      )}
    >
      <div className="max-w-4xl mx-auto px-12 py-16 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Raw YAML Configuration (if exists) */}
        {fmMatch && (
          <div className="space-y-4">
            <CodeBlock language="yaml" value={fmMatch[1].trim()} />
          </div>
        )}

        {/* Rendered Markdown Content */}
        <div
          className="prose dark:prose-invert prose-slate max-w-none 
          prose-headings:font-black prose-headings:tracking-tight prose-headings:text-foreground
          prose-h1:text-4xl prose-h1:mb-8 prose-h1:pb-4 prose-h1:border-b prose-h1:border-border/40
          prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6
          prose-p:text-base prose-p:leading-8 prose-p:text-foreground/80
          prose-strong:text-foreground prose-strong:font-bold
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-a:font-semibold
          prose-blockquote:border-l-4 prose-blockquote:border-primary/40 prose-blockquote:bg-primary/[0.02] prose-blockquote:px-6 prose-blockquote:py-1 prose-blockquote:rounded-r-xl prose-blockquote:italic
          prose-code:text-primary prose-code:bg-primary/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-transparent prose-pre:p-0
          prose-ul:list-disc prose-ol:list-decimal
          prose-li:my-2
          prose-img:rounded-2xl prose-img:shadow-2xl prose-img:border prose-img:border-border/40
          prose-hr:border-border/40
        "
        >
          <Markdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              code({ node, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '')
                const isInline = !match
                if (isInline) {
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  )
                }
                return (
                  <CodeBlock
                    language={match[1]}
                    value={String(children).replace(/\n$/, '')}
                  />
                )
              },
              a({ node, children, ...props }) {
                const href = props.href || ''
                // Intercept local file links — open in file browser
                if (isLocalPath(href)) {
                  return (
                    <a
                      {...props}
                      href={href}
                      onClick={(e) => handleLocalLink(e, href)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleLocalLink(e as any, href)
                        }
                      }}
                      className={props.className}
                    >
                      {children}
                    </a>
                  )
                }
                // External http/https links open in system browser
                return (
                  <a
                    {...props}
                    target="_blank"
                    rel="noopener noreferrer"
                    href={href}
                    onClick={(e) => {
                      e.preventDefault()
                      window.aynite.openExternal(href)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        window.aynite.openExternal(href)
                      }
                    }}
                  >
                    {children}
                  </a>
                )
              },
              img({ node, ...props }) {
                const src = props.src || ''
                // Resolve local image paths
                if (isLocalPath(src)) {
                  const resolvedSrc = resolveLocalPath(src, file.path)
                  return (
                    <img
                      {...props}
                      src={`aynite-resource://${resolvedSrc}`}
                      alt={props.alt || ''}
                    />
                  )
                }
                /* biome-ignore lint/a11y/useAltText: alt text comes from markdown content via props.alt */
                return <img {...props} />
              },
            }}
          >
            {fmMatch ? markdown.substring(fmMatch[0].length).trim() : markdown}
          </Markdown>
        </div>

        {/* Footer Info */}
        <div className="pt-12 border-t border-border/20 flex items-center justify-between text-muted-foreground/40">
          <div className="flex items-center gap-2 text-[11px] font-medium tracking-wider uppercase">
            <Info size={14} />
            <span>{file.name}</span>
          </div>
          <div className="text-[11px] font-medium tracking-wider uppercase">
            {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  )
}
