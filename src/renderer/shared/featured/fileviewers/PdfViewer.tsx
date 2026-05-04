import React from 'react';
import { UnifiedViewer } from './UnifiedViewer';
import { FileInfo } from '../../lib/file-handlers';

export const PdfViewer: React.FC<{ file: FileInfo }> = ({ file }) => (
  <UnifiedViewer src={`aynite-resource://${file.path}`} padding="p-0" />
);
