# FileViewAudio — Dependencies

## Context Providers

| Provider | Functions Used | Purpose |
|----------|---------------|---------|
| **Bridge: file** | `bridgeFile.readBinary(path)` | Read audio file as binary for playback |

## Events

| Event | Payload | Handler |
|-------|---------|---------|
| _none_ | — | No event subscriptions |

## Description

Audio player view. Reads file as binary from bridge, creates a blob URL, and renders an `<audio>` element with controls. Supports mp3, wav, flac, aac, ogg, opus, wma.
