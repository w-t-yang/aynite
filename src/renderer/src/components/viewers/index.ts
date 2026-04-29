import { FileCategory, FileInfo } from '../../lib/file-handlers';
import { MarkdownViewer } from './MarkdownViewer';
import { HtmlViewer } from './HtmlViewer';
import { ImageViewer } from './ImageViewer';
import { VideoViewer } from './VideoViewer';
import { AudioViewer } from './AudioViewer';
import { PdfViewer } from './PdfViewer';
import { UnsupportedViewer } from './UnsupportedViewer';

export * from './UnifiedViewer';
export * from './MarkdownViewer';
export * from './HtmlViewer';
export * from './ImageViewer';
export * from './VideoViewer';
export * from './AudioViewer';
export * from './PdfViewer';
export * from './UnsupportedViewer';

export const FileHandlerComponents: Record<FileCategory, React.FC<{ file: FileInfo; content?: string; reason?: 'too_large' | 'binary' | 'other' }>> = {
  markdown: MarkdownViewer,
  html: HtmlViewer,
  image: ImageViewer,
  video: VideoViewer,
  audio: AudioViewer,
  pdf: PdfViewer,
  text: () => null, // Handled internally by FileViewer
  unsupported: UnsupportedViewer
};
