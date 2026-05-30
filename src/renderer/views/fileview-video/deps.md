# FileViewVideo — Dependencies

## Context Providers

| Provider | Functions Used | Purpose |
|----------|---------------|---------|
| **Bridge: file** | `bridgeFile.readBinary(path)` | Read video file as binary for playback |

## Events

| Event | Payload | Handler |
|-------|---------|---------|
| _none_ | — | No event subscriptions |

## Description

Video player with zoom/fit controls. Reads binary via bridge, creates blob URL, renders `<video>` with controls. Supports mp4, webm, mov, avi, mkv formats. Auto-fits to viewport on initial load.
