import React from 'react';
import Prism from 'prismjs';
import { UnifiedViewer } from './UnifiedViewer';
import { FileInfo } from '../../lib/file-handlers';

// Prism components are imported centrally in the index or here
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-yaml';

export const TextViewer: React.FC<{ file: FileInfo; content?: string }> = ({ file, content }) => {
  React.useEffect(() => { 
    Prism.highlightAll(); 
  }, [content]);

  const langMap: Record<string, string> = {
    'js': 'javascript', 'ts': 'typescript', 'jsx': 'javascript', 'tsx': 'typescript',
    'json': 'json', 'css': 'css', 'html': 'html', 'py': 'python', 'rs': 'rust',
    'sh': 'bash', 'bash': 'bash', 'yaml': 'yaml', 'yml': 'yaml', 'md': 'markdown'
  };
  const lang = langMap[file.extension] || 'text';

  return (
    <UnifiedViewer padding="p-8">
      <pre className={`language-${lang} !m-0 !p-0 !bg-transparent`}>
        <code className={`language-${lang}`}>{content || ''}</code>
      </pre>
    </UnifiedViewer>
  );
};
