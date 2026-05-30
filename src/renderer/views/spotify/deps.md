# SpotifyApp — Dependencies

## Context Providers

| Provider | Functions Used | Purpose |
|----------|---------------|---------|
| **Bridge: systemMutations** | `systemMutations.openExternal(url)` | Open Spotify developer dashboard URL |

## Events

| Event | Payload | Handler |
|-------|---------|---------|
| _none_ | — | No event subscriptions |

## Internal hooks

| Hook | Purpose |
|------|---------|
| `useSpotify` | All Spotify state: auth, playback, playlists, tracks, top artists, recently played |

## Description

Spotify data explorer. Requires OAuth authentication with user's Spotify account. Shows timeline, saved tracks, top artists, playlists, and playback controls. All bridge calls are encapsulated in `useSpotify` hook.
