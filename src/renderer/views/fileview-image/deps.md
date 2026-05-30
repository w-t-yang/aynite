# FileViewImage — Dependencies

## Context Providers

None — stateless renderer. Uses `aynite-resource://` protocol directly for image source.

## Events

| Event | Payload | Handler |
|-------|---------|---------|
| _none_ | — | No event subscriptions |

## Description

Image viewer with zoom/pan/fit controls. Loads images via the `aynite-resource://` protocol. Detects intrinsic dimensions on load for auto-fit behavior. No bridge calls.
