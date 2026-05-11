import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  SpotifyPlaybackState,
  SpotifyPlaylist,
  SpotifyPlaylistTrackItem,
  SpotifyProfile,
  SpotifyRecentlyPlayedItem,
  SpotifySavedTrack,
  SpotifyStore,
  SpotifyTopArtists,
} from '../../../../lib/types/spotify'
import type { Section } from '../SpotifyApp'

const aw = () => window.aynite
const STALE_MS = 24 * 60 * 60 * 1000

interface SpotifyState {
  profile: SpotifyProfile | null
  recentlyPlayed: SpotifyRecentlyPlayedItem[]
  savedTracks: SpotifySavedTrack[]
  topArtists: SpotifyTopArtists
  playlists: SpotifyPlaylist[]
  playbackState: SpotifyPlaybackState
  loading: boolean
  fetching: boolean
  isAuthenticated: boolean
  protocolAvailable: boolean
  storedClientId: string
  error: string | null
  section: Section
  selectedPlaylistId: string | null
  playlistTracks: SpotifyPlaylistTrackItem[]
  playlistTracksLoading: boolean
}

const defaultPlaybackState: SpotifyPlaybackState = {
  isPlaying: false,
  track: null,
  progressMs: 0,
  durationMs: 0,
  device: null,
  shuffleState: false,
  repeatState: 'off',
}

export function useSpotify() {
  const [state, setState] = useState<SpotifyState>({
    profile: null,
    recentlyPlayed: [],
    savedTracks: [],
    topArtists: { shortTerm: [], mediumTerm: [], longTerm: [] },
    playlists: [],
    playbackState: defaultPlaybackState,
    loading: true,
    fetching: false,
    isAuthenticated: false,
    protocolAvailable: false,
    storedClientId: '',
    error: null,
    section: 'timeline',
    selectedPlaylistId: null,
    playlistTracks: [],
    playlistTracksLoading: false,
  })

  const autoFetchDone = useRef(false)
  const playbackInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAll = useCallback(async () => {
    setState((s) => ({ ...s, fetching: true, error: null }))
    try {
      const result = await aw().spotifyFetchAll()
      if (!result.success) {
        throw new Error(result.error)
      }
      const data = result.data as SpotifyStore
      setState((s) => ({
        ...s,
        profile: data.profile,
        recentlyPlayed: data.recentlyPlayed || [],
        savedTracks: data.savedTracks || [],
        topArtists: data.topArtists || {
          shortTerm: [],
          mediumTerm: [],
          longTerm: [],
        },
        playlists: data.playlists || [],
        fetching: false,
      }))
    } catch (e: any) {
      setState((s) => ({
        ...s,
        fetching: false,
        error: e?.message || 'Failed to fetch Spotify data',
      }))
    }
  }, [])

  const loadAll = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const auth = await aw().spotifyCheckAuth()
      const proto = await aw().spotifyCheckProtocol()
      const clientId = await aw().spotifyGetClientId()
      if (!auth) {
        setState((s) => ({
          ...s,
          loading: false,
          isAuthenticated: false,
          protocolAvailable: proto,
          storedClientId: clientId,
        }))
        return
      }

      const store: SpotifyStore | null = await aw().spotifyLoadAll()
      if (store) {
        setState((s) => ({
          ...s,
          profile: store.profile,
          recentlyPlayed: store.recentlyPlayed || [],
          savedTracks: store.savedTracks || [],
          topArtists: store.topArtists || {
            shortTerm: [],
            mediumTerm: [],
            longTerm: [],
          },
          playlists: store.playlists || [],
          loading: false,
          isAuthenticated: true,
          protocolAvailable: proto,
          storedClientId: clientId,
        }))
      } else {
        setState((s) => ({
          ...s,
          loading: false,
          isAuthenticated: true,
          protocolAvailable: proto,
          storedClientId: clientId,
        }))
      }

      // Auto-refresh stale data
      if (!autoFetchDone.current) {
        autoFetchDone.current = true
        const stale =
          !store?.lastFetchedAt ||
          Date.now() - new Date(store.lastFetchedAt).getTime() > STALE_MS
        if (stale) {
          await fetchAll()
        }
      }
    } catch (e: any) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e?.message || 'Failed to load Spotify data',
      }))
    }
  }, [fetchAll])

  // Refresh playback state periodically when authenticated
  const refreshPlayback = useCallback(async () => {
    try {
      const state = await aw().spotifyGetPlaybackState()
      setState((s) => ({ ...s, playbackState: state }))
    } catch {
      // Silently fail - playback might not be available
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Poll playback state every 10 seconds when authenticated
  useEffect(() => {
    if (state.isAuthenticated) {
      refreshPlayback()
      playbackInterval.current = setInterval(refreshPlayback, 10000)
    }
    return () => {
      if (playbackInterval.current) {
        clearInterval(playbackInterval.current)
        playbackInterval.current = null
      }
    }
  }, [state.isAuthenticated, refreshPlayback])

  const connect = useCallback(
    async (clientId: string, useProtocol?: boolean) => {
      setState((s) => ({ ...s, fetching: true, error: null }))
      try {
        const result = await aw().spotifyInitAuth(clientId, useProtocol)
        if (!result.success) {
          throw new Error(result.error || 'Authorization failed')
        }
        setState((s) => ({ ...s, isAuthenticated: true, fetching: false }))
        // Fetch data immediately after successful auth
        const res = await aw().spotifyFetchAll()
        if (res.success) {
          const data = res.data as SpotifyStore
          setState((s) => ({
            ...s,
            profile: data.profile,
            recentlyPlayed: data.recentlyPlayed || [],
            savedTracks: data.savedTracks || [],
            topArtists: data.topArtists || {
              shortTerm: [],
              mediumTerm: [],
              longTerm: [],
            },
            playlists: data.playlists || [],
          }))
        }
      } catch (e: any) {
        setState((s) => ({
          ...s,
          fetching: false,
          error: e?.message || 'Failed to connect to Spotify',
        }))
      }
    },
    [],
  )

  const logout = useCallback(async () => {
    await aw().spotifyLogout()
    setState((s) => ({
      ...s,
      profile: null,
      recentlyPlayed: [],
      savedTracks: [],
      topArtists: { shortTerm: [], mediumTerm: [], longTerm: [] },
      playlists: [],
      playbackState: defaultPlaybackState,
      isAuthenticated: false,
      fetching: false,
      error: null,
      section: 'timeline',
      selectedPlaylistId: null,
      playlistTracks: [],
      playlistTracksLoading: false,
    }))
    if (playbackInterval.current) {
      clearInterval(playbackInterval.current)
      playbackInterval.current = null
    }
  }, [])

  const setSection = useCallback((section: Section) => {
    setState((s) => ({ ...s, section, selectedPlaylistId: null }))
  }, [])

  const selectPlaylist = useCallback((playlistId: string | null) => {
    setState((s) => ({
      ...s,
      selectedPlaylistId: playlistId,
      playlistTracks: [],
      playlistTracksLoading: !!playlistId,
    }))
    if (playlistId) {
      // First load cached tracks from disk
      aw()
        .spotifyLoadPlaylistTracks(playlistId)
        .then((res) => {
          if (res.success && res.data?.length > 0) {
            setState((s) => ({
              ...s,
              playlistTracks: res.data,
              playlistTracksLoading: false,
            }))
          }
        })
        .catch(() => {})

      // Then fetch fresh tracks from API
      aw()
        .spotifyGetPlaylistTracks(playlistId)
        .then((res) => {
          if (res.success) {
            setState((s) => ({
              ...s,
              playlistTracks: res.data || [],
              playlistTracksLoading: false,
            }))
          } else {
            // API failed, keep loading false so cached data shows if available
            setState((s) => ({
              ...s,
              playlistTracksLoading: false,
            }))
          }
        })
        .catch(() => {
          setState((s) => ({
            ...s,
            playlistTracksLoading: false,
          }))
        })
    }
  }, [])

  // Playback controls
  const play = useCallback(async () => {
    await aw().spotifyPlay()
    refreshPlayback()
  }, [refreshPlayback])

  const pause = useCallback(async () => {
    await aw().spotifyPause()
    refreshPlayback()
  }, [refreshPlayback])

  const next = useCallback(async () => {
    await aw().spotifyNext()
    setTimeout(refreshPlayback, 500)
  }, [refreshPlayback])

  const previous = useCallback(async () => {
    await aw().spotifyPrevious()
    setTimeout(refreshPlayback, 500)
  }, [refreshPlayback])

  const playContext = useCallback(async (uri: string) => {
    try {
      await aw().spotifyPlayContext(uri)
    } catch {
      // Playback might not be available
    }
  }, [])

  const playTrack = useCallback(async (uri: string) => {
    try {
      await aw().spotifyPlayTrack(uri)
    } catch {
      // Playback might not be available
    }
  }, [])

  const playTrackInContext = useCallback(
    async (trackUri: string, contextUri: string) => {
      try {
        await aw().spotifyPlayTrackInContext(trackUri, contextUri)
      } catch {
        // Playback might not be available
      }
    },
    [],
  )

  const playTracks = useCallback(
    async (trackUris: string[], startUri?: string) => {
      try {
        await aw().spotifyPlayTracks(trackUris, startUri)
      } catch {
        // Playback might not be available
      }
    },
    [],
  )

  return {
    ...state,
    loadAll,
    fetchAll,
    connect,
    logout,
    setSection,
    selectPlaylist,
    play,
    pause,
    next,
    previous,
    refreshPlayback,
    playContext,
    playTrack,
    playTrackInContext,
    playTracks,
  }
}
