import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { UnifiedViewer } from './UnifiedViewer';
import { FileInfo } from '../../lib/file-handlers';

export const MarkdownViewer: React.FC<{ file: FileInfo; content?: string }> = ({ file, content }) => {
  const dirPath = file.path.substring(0, file.path.lastIndexOf('/'));
  return (
    <UnifiedViewer basePath={dirPath} padding="p-8">
      <div className="prose prose-invert max-w-4xl mx-auto">
        <Markdown remarkPlugins={[remarkGfm]}>{content || ''}</Markdown>
      </div>
    </UnifiedViewer>
  );
};
