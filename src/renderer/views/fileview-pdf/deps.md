# FileViewPdf — Dependencies

## Context Providers

| Provider | Functions Used | Purpose |
|----------|---------------|---------|
| **Bridge: file** | `bridgeFile.readBinary(path)` | Read PDF file as binary for pdfjs parsing |

## Events

| Event | Payload | Handler |
|-------|---------|---------|
| _none_ | — | No event subscriptions |

## Description

PDF viewer using pdfjs-dist. Reads binary data via bridge, renders pages to canvas with zoom and page navigation. Supports device pixel ratio for sharp rendering.
