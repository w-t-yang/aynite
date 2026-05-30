# FileViewHtml — Dependencies

## Context Providers

None — stateless renderer.

## Events

| Event | Payload | Handler |
|-------|---------|---------|
| _none_ | — | No event subscriptions |

## Description

HTML preview renderer. Renders HTML content inside an `iframe` with `srcdoc`, injecting theme variables, a `<base>` tag for relative resource resolution, and a history API polyfill. No bridge calls — receives content directly as a prop from the file-browser.
