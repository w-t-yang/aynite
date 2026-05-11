import { createHash, randomBytes } from 'node:crypto'
import http from 'node:http'
import { shell } from 'electron'
import {
  ensureDir,
  exists,
  getSpotifyConfigPath,
  getSpotifyDir,
  getSpotifyMetadataPath,
  getSpotifyPlaylistsPath,
  getSpotifyPlaylistTracksPath,
  getSpotifyProfilePath,
  getSpotifyRecentlyPlayedPath,
  getSpotifySavedTracksPath,
  getSpotifyTopArtistsPath,
  getSpotifyTopTracksPath,
  readJson,
  unlink,
  writeJson,
} from '../../lib/path'
import type {
  SpotifyArtist,
  SpotifyAuth,
  SpotifyConfig,
  SpotifyPlaybackState,
  SpotifyPlaylist,
  SpotifyPlaylistTrackItem,
  SpotifyProfile,
  SpotifyRecentlyPlayedItem,
  SpotifySavedTrack,
  SpotifyStore,
  SpotifyTopArtists,
  SpotifyTopTracks,
  SpotifyTrack,
} from '../../lib/types/spotify'

const STALE_MS = 24 * 60 * 60 * 1000
const SPOTIFY_API = 'https://api.spotify.com/v1'
const AUTH_PORT = 18080
const AUTH_TIMEOUT_MS = 5 * 60 * 1000

const PROTOCOL_REDIRECT_URI = 'aynite://auth/spotify/callback'
const SERVER_REDIRECT_URI = `http://127.0.0.1:${AUTH_PORT}/callback`

const SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-read-recently-played',
  'user-library-read',
  'user-top-read',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
]

// ── Config Helpers ──────────────────────────────────────────────────────

async function loadConfig(): Promise<SpotifyConfig> {
  const path = getSpotifyConfigPath()
  if (!(await exists(path))) {
    return { auth: null, clientId: '' }
  }
  return readJson<SpotifyConfig>(path, { auth: null, clientId: '' })
}

async function saveConfig(config: SpotifyConfig): Promise<void> {
  await writeJson(getSpotifyConfigPath(), config)
}

// ── Auth Helpers ────────────────────────────────────────────────────────

function base64url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// Tracks a single pending authorization attempt (protocol or server)
interface PendingAuth {
  resolve: (result: { success: boolean; error?: string }) => void
  verifier: string
  clientId: string
  redirectUri: string
  timeout: ReturnType<typeof setTimeout>
}

let pendingAuth: PendingAuth | null = null
let callbackServer: http.Server | null = null

// Called by the protocol handler in main/index.ts when aynite://auth/spotify/callback arrives
export async function handleSpotifyAuthCode(code: string): Promise<void> {
  const pa = pendingAuth
  if (!pa) return

  // Only handle protocol-based callbacks
  if (pa.redirectUri !== PROTOCOL_REDIRECT_URI) return

  pendingAuth = null
  clearTimeout(pa.timeout)
  closeCallbackServer()

  try {
    await exchangeToken(code, pa.verifier, pa.clientId, pa.redirectUri)
    pa.resolve({ success: true })
  } catch (err) {
    pa.resolve({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

async function exchangeToken(
  code: string,
  verifier: string,
  clientId: string,
  redirectUri: string,
): Promise<void> {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token exchange failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  const auth: SpotifyAuth = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  }

  const config = await loadConfig()
  await saveConfig({ ...config, auth })
}

let tokenRefreshPromise: Promise<string> | null = null

async function ensureValidToken(): Promise<string> {
  const config = await loadConfig()
  if (!config.auth) {
    throw new Error('Not authenticated with Spotify')
  }

  if (Date.now() < config.auth.expiresAt) {
    return config.auth.accessToken
  }

  // Deduplicate concurrent refresh requests
  if (tokenRefreshPromise) {
    return tokenRefreshPromise
  }

  tokenRefreshPromise = (async () => {
    const cfg = await loadConfig()

    // ensureValidToken guarantees config.auth to callers, but at the
    // point this closure runs a concurrent refresh may have cleared it
    const auth = cfg.auth
    if (!auth) {
      throw new Error('Auth config cleared during token refresh')
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: auth.refreshToken,
        client_id: cfg.clientId,
      }),
    })

    if (!response.ok) {
      throw new Error(
        `Token refresh failed: ${response.status} ${response.statusText}`,
      )
    }

    const data = await response.json()
    auth.accessToken = data.access_token
    auth.expiresAt = Date.now() + (data.expires_in || 3600) * 1000
    if (data.refresh_token) {
      auth.refreshToken = data.refresh_token
    }
    await saveConfig(cfg)
    return auth.accessToken
  })()

  try {
    return await tokenRefreshPromise
  } finally {
    tokenRefreshPromise = null
  }
}

// ── Public Auth Functions ───────────────────────────────────────────────

export async function initAuth(
  clientId: string,
  useProtocol: boolean,
): Promise<{ success: boolean; error?: string }> {
  await ensureDir(getSpotifyDir())
  await saveConfig({ ...(await loadConfig()), clientId })

  const codeVerifier = base64url(randomBytes(32))
  const codeChallenge = base64url(
    createHash('sha256').update(codeVerifier).digest(),
  )
  const redirectUri = useProtocol ? PROTOCOL_REDIRECT_URI : SERVER_REDIRECT_URI

  const state = base64url(randomBytes(16))
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    redirect_uri: redirectUri,
    scope: SCOPES.join(' '),
    state,
  })

  const authUrl = `https://accounts.spotify.com/authorize?${params}`

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (pendingAuth) {
        pendingAuth = null
        closeCallbackServer()
        resolve({
          success: false,
          error: 'Authorization timed out after 5 minutes',
        })
      }
    }, AUTH_TIMEOUT_MS)

    pendingAuth = {
      resolve,
      verifier: codeVerifier,
      clientId,
      redirectUri,
      timeout,
    }

    // Start local HTTP server as fallback (only used when useProtocol=false)
    if (!useProtocol) {
      startCallbackServer(
        state,
        codeVerifier,
        clientId,
        redirectUri,
        resolve,
        timeout,
      )
    }

    shell.openExternal(authUrl)
  })
}

function startCallbackServer(
  state: string,
  verifier: string,
  clientId: string,
  redirectUri: string,
  resolve: (result: { success: boolean; error?: string }) => void,
  timeout: ReturnType<typeof setTimeout>,
): void {
  if (callbackServer) {
    callbackServer.close()
  }

  let settled = false

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '', `http://127.0.0.1:${AUTH_PORT}`)

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code')
      const returnedState = url.searchParams.get('state')

      if (!code || returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end(
          '<h1>Authorization failed</h1><p>State mismatch or missing code.</p>',
        )
        if (!settled && pendingAuth) {
          settled = true
          pendingAuth = null
          clearTimeout(timeout)
          closeCallbackServer()
          resolve({
            success: false,
            error: 'OAuth callback validation failed',
          })
        }
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(
        '<h1>Authorization successful!</h1><p>You can close this tab and return to the app.</p>',
      )

      if (!settled && pendingAuth) {
        settled = true
        pendingAuth = null
        clearTimeout(timeout)
        closeCallbackServer()

        try {
          await exchangeToken(code, verifier, clientId, redirectUri)
          resolve({ success: true })
        } catch (err) {
          resolve({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }
  })

  server.listen(AUTH_PORT, '127.0.0.1', () => {
    // Server is listening
  })

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (!settled) {
      settled = true
    }
    if (err.code === 'EADDRINUSE') {
      console.error(
        '[Spotify] Port 18080 in use — server-based callback unavailable',
      )
    }
  })

  callbackServer = server
}

function closeCallbackServer() {
  if (callbackServer) {
    callbackServer.close()
    callbackServer = null
  }
}

export async function checkAuth(): Promise<boolean> {
  const config = await loadConfig()
  if (!config.auth) return false
  if (Date.now() >= config.auth.expiresAt) {
    try {
      await ensureValidToken()
      return true
    } catch {
      return false
    }
  }
  return true
}

export async function checkAuthPending(): Promise<boolean> {
  return pendingAuth !== null
}

export async function logout(): Promise<void> {
  const config = await loadConfig()
  config.auth = null
  await saveConfig(config)
  // Clear cached data files
  const paths = [
    getSpotifyProfilePath(),
    getSpotifyRecentlyPlayedPath(),
    getSpotifySavedTracksPath(),
    getSpotifyTopArtistsPath(),
    getSpotifyTopTracksPath(),
    getSpotifyPlaylistsPath(),
    getSpotifyMetadataPath(),
  ]
  await Promise.all(
    paths.map(async (p) => {
      if (await exists(p)) await unlink(p)
    }),
  )
}

export async function getStoredClientId(): Promise<string> {
  const config = await loadConfig()
  return config.clientId || ''
}

// ── API Helpers ─────────────────────────────────────────────────────────

async function spotifyApiGet(path: string): Promise<any> {
  const token = await ensureValidToken()
  const response = await fetch(`${SPOTIFY_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw new Error(`Spotify API ${response.status}: ${response.statusText}`)
  }
  if (response.status === 204) return null
  return response.json()
}

async function spotifyApiPut(path: string, body?: unknown): Promise<void> {
  const token = await ensureValidToken()
  const response = await fetch(`${SPOTIFY_API}${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok && response.status !== 204) {
    throw new Error(`Spotify API ${response.status}: ${response.statusText}`)
  }
}

async function spotifyApiPost(path: string): Promise<void> {
  const token = await ensureValidToken()
  const response = await fetch(`${SPOTIFY_API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok && response.status !== 204) {
    throw new Error(`Spotify API ${response.status}: ${response.statusText}`)
  }
}

// ── Data Fetching ──────────────────────────────────────────────────────

async function fetchProfile(): Promise<SpotifyProfile> {
  const data = await spotifyApiGet('/me')
  return {
    displayName: data.display_name || data.id,
    email: data.email || '',
    country: data.country || '',
    product: data.product || '',
    followers: data.followers?.total || 0,
    images: data.images || [],
  }
}

async function fetchRecentlyPlayed(): Promise<SpotifyRecentlyPlayedItem[]> {
  const data = await spotifyApiGet('/me/player/recently-played?limit=50')
  return (data.items || []).map((item: any) => ({
    track: transformTrack(item.track),
    playedAt: item.played_at,
    context: item.context || null,
  }))
}

async function fetchSavedTracks(): Promise<SpotifySavedTrack[]> {
  const data = await spotifyApiGet('/me/tracks?limit=50')
  return (data.items || []).map((item: any) => ({
    track: transformTrack(item.track),
    addedAt: item.added_at,
  }))
}

async function fetchTopArtists(): Promise<SpotifyTopArtists> {
  const [shortTerm, mediumTerm, longTerm] = await Promise.all([
    spotifyApiGet('/me/top/artists?time_range=short_term&limit=20'),
    spotifyApiGet('/me/top/artists?time_range=medium_term&limit=20'),
    spotifyApiGet('/me/top/artists?time_range=long_term&limit=20'),
  ])
  return {
    shortTerm: (shortTerm.items || []).map(transformArtist),
    mediumTerm: (mediumTerm.items || []).map(transformArtist),
    longTerm: (longTerm.items || []).map(transformArtist),
  }
}

async function fetchTopTracks(): Promise<SpotifyTopTracks> {
  const [shortTerm, mediumTerm, longTerm] = await Promise.all([
    spotifyApiGet('/me/top/tracks?time_range=short_term&limit=20'),
    spotifyApiGet('/me/top/tracks?time_range=medium_term&limit=20'),
    spotifyApiGet('/me/top/tracks?time_range=long_term&limit=20'),
  ])
  return {
    shortTerm: (shortTerm.items || []).map(transformTrack),
    mediumTerm: (mediumTerm.items || []).map(transformTrack),
    longTerm: (longTerm.items || []).map(transformTrack),
  }
}

async function fetchPlaylists(): Promise<SpotifyPlaylist[]> {
  const data = await spotifyApiGet('/me/playlists?limit=50')
  return (data.items || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    description: item.description || '',
    images: item.images || [],
    owner: {
      id: item.owner?.id || '',
      displayName: item.owner?.display_name || '',
    },
    tracks: { total: item.items?.total || 0 },
    public: item.public || false,
    uri: item.uri,
  }))
}

// ── Transform Helpers ──────────────────────────────────────────────────

function transformTrack(item: any): SpotifyTrack {
  return {
    id: item.id,
    name: item.name,
    artists: (item.artists || []).map((a: any) => ({
      id: a.id,
      name: a.name,
    })),
    album: {
      id: item.album?.id || '',
      name: item.album?.name || '',
      images: item.album?.images || [],
    },
    durationMs: item.duration_ms || 0,
    popularity: item.popularity || 0,
    explicit: item.explicit || false,
    uri: item.uri,
  }
}

function transformArtist(item: any): SpotifyArtist {
  return {
    id: item.id,
    name: item.name,
    genres: item.genres || [],
    images: item.images || [],
    followers: item.followers?.total || 0,
    popularity: item.popularity || 0,
    uri: item.uri,
  }
}

// ── Public Data Functions ──────────────────────────────────────────────

export async function fetchAllData(): Promise<SpotifyStore> {
  const [
    profile,
    recentlyPlayed,
    savedTracks,
    topArtists,
    topTracks,
    playlists,
  ] = await Promise.all([
    fetchProfile(),
    fetchRecentlyPlayed(),
    fetchSavedTracks(),
    fetchTopArtists(),
    fetchTopTracks(),
    fetchPlaylists(),
  ])

  const lastFetchedAt = new Date().toISOString()

  await Promise.all([
    writeJson(getSpotifyProfilePath(), profile),
    writeJson(getSpotifyRecentlyPlayedPath(), recentlyPlayed),
    writeJson(getSpotifySavedTracksPath(), savedTracks),
    writeJson(getSpotifyTopArtistsPath(), topArtists),
    writeJson(getSpotifyTopTracksPath(), topTracks),
    writeJson(getSpotifyPlaylistsPath(), playlists),
    writeJson(getSpotifyMetadataPath(), { lastFetchedAt }),
  ])

  return {
    profile,
    recentlyPlayed,
    savedTracks,
    topArtists,
    topTracks,
    playlists,
    lastFetchedAt,
  }
}

export async function loadAllFromDisk(): Promise<SpotifyStore | null> {
  const [
    profile,
    recentlyPlayed,
    savedTracks,
    topArtists,
    topTracks,
    playlists,
    metadata,
  ] = await Promise.all([
    readJson<SpotifyProfile | null>(getSpotifyProfilePath(), null),
    readJson<SpotifyRecentlyPlayedItem[]>(getSpotifyRecentlyPlayedPath(), []),
    readJson<SpotifySavedTrack[]>(getSpotifySavedTracksPath(), []),
    readJson<SpotifyTopArtists>(getSpotifyTopArtistsPath(), {
      shortTerm: [],
      mediumTerm: [],
      longTerm: [],
    }),
    readJson<SpotifyTopTracks>(getSpotifyTopTracksPath(), {
      shortTerm: [],
      mediumTerm: [],
      longTerm: [],
    }),
    readJson<SpotifyPlaylist[]>(getSpotifyPlaylistsPath(), []),
    readJson<{ lastFetchedAt: string | null }>(getSpotifyMetadataPath(), {
      lastFetchedAt: null,
    }),
  ])

  if (!profile) return null

  return {
    profile,
    recentlyPlayed,
    savedTracks,
    topArtists,
    topTracks,
    playlists,
    lastFetchedAt: metadata.lastFetchedAt,
  }
}

export async function isStale(): Promise<boolean> {
  const metadata = await readJson<{ lastFetchedAt: string | null }>(
    getSpotifyMetadataPath(),
    { lastFetchedAt: null },
  )
  if (!metadata.lastFetchedAt) return true
  return Date.now() - new Date(metadata.lastFetchedAt).getTime() > STALE_MS
}

// ── Playback ───────────────────────────────────────────────────────────

export async function getPlaybackState(): Promise<SpotifyPlaybackState> {
  try {
    const data = await spotifyApiGet('/me/player')
    if (!data) {
      return {
        isPlaying: false,
        track: null,
        progressMs: 0,
        durationMs: 0,
        device: null,
        shuffleState: false,
        repeatState: 'off',
      }
    }
    return {
      isPlaying: data.is_playing || false,
      track: data.item ? transformTrack(data.item) : null,
      progressMs: data.progress_ms || 0,
      durationMs: data.item?.duration_ms || 0,
      device: data.device
        ? {
            id: data.device.id,
            name: data.device.name,
            type: data.device.type,
          }
        : null,
      shuffleState: data.shuffle_state || false,
      repeatState: data.repeat_state || 'off',
    }
  } catch {
    return {
      isPlaying: false,
      track: null,
      progressMs: 0,
      durationMs: 0,
      device: null,
      shuffleState: false,
      repeatState: 'off',
    }
  }
}

export async function play(): Promise<void> {
  await spotifyApiPut('/me/player/play')
}

export async function pause(): Promise<void> {
  await spotifyApiPut('/me/player/pause')
}

export async function next(): Promise<void> {
  await spotifyApiPost('/me/player/next')
}

export async function previous(): Promise<void> {
  await spotifyApiPost('/me/player/previous')
}

export async function playTrack(trackUri: string): Promise<void> {
  await spotifyApiPut('/me/player/play', { uris: [trackUri] })
}

export async function playTrackInContext(
  trackUri: string,
  contextUri: string,
): Promise<void> {
  await spotifyApiPut('/me/player/play', {
    context_uri: contextUri,
    offset: { uri: trackUri },
  })
}

export async function playTracks(
  trackUris: string[],
  startUri?: string,
): Promise<void> {
  const body: { uris: string[]; offset?: { uri: string } } = {
    uris: trackUris,
  }
  if (startUri) {
    body.offset = { uri: startUri }
  }
  await spotifyApiPut('/me/player/play', body)
}

export async function playContext(contextUri: string): Promise<void> {
  await spotifyApiPut('/me/player/play', { context_uri: contextUri })
}

// ── Playlist Tracks ────────────────────────────────────────────

export async function loadPlaylistTracksFromDisk(
  playlistId: string,
): Promise<SpotifyPlaylistTrackItem[]> {
  const path = getSpotifyPlaylistTracksPath(playlistId)
  if (!(await exists(path))) return []
  try {
    return await readJson<SpotifyPlaylistTrackItem[]>(path)
  } catch {
    return []
  }
}

export async function fetchPlaylistTracks(
  playlistId: string,
): Promise<SpotifyPlaylistTrackItem[]> {
  // Playlist detail endpoint includes tracks in data.items.items
  const data = await spotifyApiGet(`/playlists/${playlistId}`)
  const items = data.items?.items || []
  const tracks = items
    .filter((entry: any) => entry.item?.type === 'track' && entry.item != null)
    .map((entry: any) => ({
      track: transformTrack(entry.item),
      addedAt: entry.added_at,
    }))

  // Cache to disk
  await writeJson(getSpotifyPlaylistTracksPath(playlistId), tracks)
  return tracks
}
