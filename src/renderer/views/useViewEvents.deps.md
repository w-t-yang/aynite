# useViewEvents — Hook Documentation

Not a view — this is the shared hook module used by all iframe views to subscribe to relayed app events.

## Exports

| Export | Type | Purpose |
|--------|------|---------|
| `useViewEvent(type, callback, deps?)` | Hook | Subscribe to a single relayed event by name (without `aynite:` prefix) |
| `useViewEventSubscriber()` | Hook | Returns a subscribe function for listening to ALL relayed events |

## Architecture

Events flow: `AppContext` → `postMessage` → `useViewEvent` in iframe → view component updates.

Each iframe view receives ALL events but only processes the ones it cares about. This is by design — views are independent micro-frontends.
