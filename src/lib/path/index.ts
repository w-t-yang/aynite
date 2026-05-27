/**
 * Barrel — re-exports everything from resolve.ts and operations.ts.
 *
 * All consumers import from 'src/lib/path' and get the same exports
 * as the old monolithic src/lib/path.ts. No import changes needed.
 */

export * from './operations'
export * from './resolve'
