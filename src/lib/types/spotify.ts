export interface SpotifyAuth {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface SpotifyProfile {
  displayName: string
  email: string
  country: string
  product: string
  followers: number
  images: { url: string }[]
}

export interface SpotifyArtist {
  id: string
  name: string
  genres: string[]
  images: { url: string; width: number; height: number }[]
  followers: number
  popularity: number
  uri: string
}

export interface SpotifyAlbum {
  id: string
  name: string
  images: { url: string; width: number; height: number }[]
}

export interface SpotifyTrack {
  id: string
  name: string
  artists: { id: string; name: string }[]
  album: SpotifyAlbum
  durationMs: number
  popularity: number
  explicit: boolean
  uri: string
}

export interface SpotifyRecentlyPlayedItem {
  track: SpotifyTrack
  playedAt: string
  context: { type: string; uri: string } | null
}

export interface SpotifySavedTrack {
  track: SpotifyTrack
  addedAt: string
}

export interface SpotifyTopArtists {
  shortTerm: SpotifyArtist[]
  mediumTerm: SpotifyArtist[]
  longTerm: SpotifyArtist[]
}

export interface SpotifyTopTracks {
  shortTerm: SpotifyTrack[]
  mediumTerm: SpotifyTrack[]
  longTerm: SpotifyTrack[]
}

export interface SpotifyPlaylist {
  id: string
  name: string
  description: string
  images: { url: string }[]
  owner: { id: string; displayName: string }
  tracks: { total: number; items?: SpotifyTrack[] }
  public: boolean
  uri: string
}

export interface SpotifyPlaylistTrackItem {
  track: SpotifyTrack
  addedAt: string
}

export interface SpotifyPlaybackState {
  isPlaying: boolean
  track: SpotifyTrack | null
  progressMs: number
  durationMs: number
  device: { id: string; name: string; type: string } | null
  shuffleState: boolean
  repeatState: string
}

export interface SpotifyStore {
  profile: SpotifyProfile | null
  recentlyPlayed: SpotifyRecentlyPlayedItem[]
  savedTracks: SpotifySavedTrack[]
  topArtists: SpotifyTopArtists
  topTracks: SpotifyTopTracks
  playlists: SpotifyPlaylist[]
  lastFetchedAt: string | null
}

export interface SpotifyConfig {
  auth: SpotifyAuth | null
  clientId: string
}
