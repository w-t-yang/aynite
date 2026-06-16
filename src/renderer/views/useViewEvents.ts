/**
 * useViewEvents — Backward-compat re-exports.
 *
 * The actual implementations live in ViewContext.tsx (the Spoke file)
 * to satisfy the hub-and-spoke architecture audit rules.
 *
 * @deprecated Import directly from './ViewContext' instead:
 *   `import { useAppEvent, useAppEventSubscriber } from '../ViewContext'`
 */

export { useAppEvent, useAppEventSubscriber } from './ViewContext'
