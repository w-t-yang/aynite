/**
 * Bridge module: Spotify operations
 *
 * Typed getters and setters for Spotify integration.
 */

function getAynite() {
  if (!window.aynite) {
    throw new Error('Aynite bridge not available (not running in Electron?)')
  }
  return window.aynite
}

// ── Getters (return data) ────────────────────────────────────────────

export const spotify = (() => ({
  checkAuth: (): Promise<boolean> => getAynite().spotifyCheckAuth(),

  checkProtocol: (): Promise<boolean> => getAynite().spotifyCheckProtocol(),

  getClientId: (): Promise<string> => getAynite().spotifyGetClientId(),

  loadAll: (): Promise<any> => getAynite().spotifyLoadAll(),

  fetchAll: (): Promise<{ success: boolean; data?: any; error?: string }> =>
    getAynite().spotifyFetchAll(),

  getPlaybackState: (): Promise<any> => getAynite().spotifyGetPlaybackState(),

  getPlaylistTracks: (
    playlistId: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> =>
    getAynite().spotifyGetPlaylistTracks(playlistId),

  loadPlaylistTracks: (
    playlistId: string,
  ): Promise<{ success: boolean; data?: any }> =>
    getAynite().spotifyLoadPlaylistTracks(playlistId),
}))()

// ── Setters (return void) ────────────────────────────────────────────

export const spotifyMutations = (() => ({
  initAuth: (
    clientId: string,
    useProtocol?: boolean,
  ): Promise<{ success: boolean; error?: string }> =>
    getAynite().spotifyInitAuth(clientId, useProtocol),

  logout: (): Promise<{ success: boolean; error?: string }> =>
    getAynite().spotifyLogout(),

  play: (): Promise<{ success: boolean; error?: string }> =>
    getAynite().spotifyPlay(),

  pause: (): Promise<{ success: boolean; error?: string }> =>
    getAynite().spotifyPause(),

  next: (): Promise<{ success: boolean; error?: string }> =>
    getAynite().spotifyNext(),

  previous: (): Promise<{ success: boolean; error?: string }> =>
    getAynite().spotifyPrevious(),

  playTrack: (uri: string): Promise<{ success: boolean; error?: string }> =>
    getAynite().spotifyPlayTrack(uri),

  playTrackInContext: (
    trackUri: string,
    contextUri: string,
  ): Promise<{ success: boolean; error?: string }> =>
    getAynite().spotifyPlayTrackInContext(trackUri, contextUri),

  playTracks: (
    trackUris: string[],
    startUri?: string,
  ): Promise<{ success: boolean; error?: string }> =>
    getAynite().spotifyPlayTracks(trackUris, startUri),

  playContext: (uri: string): Promise<{ success: boolean; error?: string }> =>
    getAynite().spotifyPlayContext(uri),
}))()
