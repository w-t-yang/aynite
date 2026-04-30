import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import yaml from 'js-yaml';
import { UnifiedViewer } from './UnifiedViewer';
import { FileInfo } from '../../lib/file-handlers';

export const MarkdownViewer: React.FC<{ file: FileInfo; content?: string }> = ({ file, content }) => {
  const dirPath = file.path.substring(0, file.path.lastIndexOf('/'));
  
  // Parse frontmatter
  let frontmatter: any = null;
  let markdown = content || '';
  
  const fmMatch = markdown.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (fmMatch) {
    try {
      frontmatter = yaml.load(fmMatch[1]);
      markdown = markdown.substring(fmMatch[0].length).trim();
    } catch (e) {
      console.warn('Failed to parse frontmatter:', e);
    }
  }

  return (
    <UnifiedViewer basePath={dirPath} padding="p-8">
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
        {frontmatter && (
          <div className="bg-muted/20 border border-border/50 rounded-2xl p-8 mb-10 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary/40" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-6 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              Skill Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              {Object.entries(frontmatter).map(([key, value]) => (
                <div key={key} className={`flex flex-col gap-1.5 ${key === 'description' || String(value).length > 50 ? 'md:col-span-2' : ''}`}>
                  <span className="text-[10px] font-bold text-primary/80 uppercase tracking-wide">{key}</span>
                  <span className="text-[13px] text-foreground/80 leading-relaxed font-medium">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="prose prose-invert prose-slate max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h1:tracking-tight prose-pre:bg-muted/40 prose-pre:border prose-pre:border-border/40">
          <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
        </div>
      </div>
    </UnifiedViewer>
  );
};
