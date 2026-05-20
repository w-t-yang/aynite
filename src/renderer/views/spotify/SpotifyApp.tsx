import { Disc3, Loader2, LogOut, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import {
  SPOTIFY_AUTH_CALLBACK,
  SPOTIFY_AUTH_CALLBACK_HTTP,
} from '../../../lib/constants/app'
import { PlayerBar } from './components/PlayerBar'
import { Playlists } from './components/Playlists'
import { PlaylistTracks } from './components/PlaylistTracks'
import { SavedTracks } from './components/SavedTracks'
import { Sidebar } from './components/Sidebar'
import { Timeline } from './components/Timeline'
import { TopArtists } from './components/TopArtists'
import { useSpotify } from './hooks/useSpotify'

type Section = 'timeline' | 'saved' | 'artists' | 'playlists'

export type { Section }

export function SpotifyApp() {
  const spotify = useSpotify()
  const clientIdRef = useRef<HTMLInputElement>(null)

  const oauthCallbackUrl = spotify.protocolAvailable
    ? SPOTIFY_AUTH_CALLBACK
    : SPOTIFY_AUTH_CALLBACK_HTTP

  // Pre-fill stored client ID once loaded
  useEffect(() => {
    if (!spotify.loading && !spotify.isAuthenticated && clientIdRef.current) {
      clientIdRef.current.value = spotify.storedClientId || ''
    }
  }, [spotify.loading, spotify.isAuthenticated, spotify.storedClientId])

  const handleConnect = useCallback(
    async (clientId: string, useProtocol?: boolean) => {
      await spotify.connect(clientId, useProtocol)
    },
    [spotify],
  )

  const handleRefresh = useCallback(() => {
    spotify.fetchAll()
  }, [spotify])

  const handleLogout = useCallback(() => {
    spotify.logout()
  }, [spotify])

  const handlePlayPlaylist = useCallback(
    (uri: string) => {
      spotify.playContext(uri)
    },
    [spotify],
  )

  const handlePlayTrack = useCallback(
    (uri: string) => {
      spotify.playTrack(uri)
    },
    [spotify],
  )

  const handlePlayPlaylistTrack = useCallback(
    (trackUri: string) => {
      const playlist = spotify.playlists.find(
        (p) => p.id === spotify.selectedPlaylistId,
      )
      if (playlist) {
        spotify.playTrackInContext(trackUri, playlist.uri)
      }
    },
    [spotify],
  )

  const handlePlaySavedTrack = useCallback(
    (trackUri: string) => {
      const uris = spotify.savedTracks.map((st) => st.track.uri)
      if (uris.length > 0) {
        spotify.playTracks(uris, trackUri)
      }
    },
    [spotify],
  )

  if (spotify.loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Authentication wall
  if (!spotify.isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
          <Disc3 size={48} className="text-primary/60" />
          <h2 className="text-lg font-semibold text-foreground">
            Spotify Explorer
          </h2>
          <p className="text-sm text-muted-foreground">
            Connect your Spotify account to explore your music data.
          </p>

          <input
            ref={clientIdRef}
            type="text"
            placeholder="Spotify Client ID"
            id="spotify-client-id"
            className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
          />

          {spotify.error && (
            <p className="text-xs text-destructive">{spotify.error}</p>
          )}

          <button
            type="button"
            onClick={() => {
              const input = clientIdRef.current
              if (input?.value)
                handleConnect(input.value, spotify.protocolAvailable)
            }}
            disabled={spotify.fetching}
            className="w-full px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            {spotify.fetching ? (
              <Loader2 size={14} className="animate-spin mx-auto" />
            ) : (
              'Connect to Spotify'
            )}
          </button>

          {/* Instructions */}
          <div className="w-full text-left bg-muted/50 rounded-md p-3 space-y-2">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
              Setup Instructions
            </p>
            <ol className="text-[10px] text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>
                Go to{' '}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() =>
                    window.aynite.openExternal(
                      'https://developer.spotify.com/dashboard',
                    )
                  }
                >
                  developer.spotify.com/dashboard
                </button>{' '}
                and create an app (or use an existing one).
              </li>
              <li>
                Add your <strong>email</strong> under "User Management" in the
                app settings so the API works for your account.
              </li>
              <li>
                Add this redirect URI to the app's settings:
                <br />
                <code className="text-primary/80 bg-muted px-1 rounded">
                  {oauthCallbackUrl}
                </code>
              </li>
              <li>
                Copy the <strong>Client ID</strong> from the app dashboard and
                paste it above.
              </li>
            </ol>
          </div>

          {!spotify.protocolAvailable && (
            <p className="text-[10px] text-muted-foreground/60">
              The app will start a temporary server on port 18080 to receive the
              OAuth callback after you authorize.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <div className="h-10 border-b border-border flex items-center px-4 gap-3 bg-muted/30 justify-between shrink-0 relative z-popover">
        <div className="flex items-center gap-2 min-w-0">
          <Disc3 size={14} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest truncate text-muted-foreground">
            Spotify Explorer
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={spotify.fetching}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-30"
            title="Refresh Spotify data"
          >
            <RefreshCw
              size={14}
              className={spotify.fetching ? 'animate-spin' : ''}
            />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            title="Disconnect Spotify"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden pb-14">
        <Sidebar
          profile={spotify.profile}
          section={spotify.section}
          onSectionChange={spotify.setSection}
          onRefresh={handleRefresh}
        />

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {spotify.section === 'timeline' && (
            <Timeline
              recentlyPlayed={spotify.recentlyPlayed}
              savedTracks={spotify.savedTracks}
              onPlayTrack={handlePlayTrack}
            />
          )}
          {spotify.section === 'saved' && (
            <SavedTracks
              tracks={spotify.savedTracks}
              onPlayTrack={handlePlaySavedTrack}
            />
          )}
          {spotify.section === 'artists' && (
            <TopArtists topArtists={spotify.topArtists} />
          )}
          {spotify.section === 'playlists' && !spotify.selectedPlaylistId && (
            <Playlists
              playlists={spotify.playlists}
              onSelectPlaylist={spotify.selectPlaylist}
              onPlayPlaylist={handlePlayPlaylist}
            />
          )}
          {spotify.section === 'playlists' && spotify.selectedPlaylistId && (
            <PlaylistTracks
              playlist={spotify.playlists.find(
                (p) => p.id === spotify.selectedPlaylistId,
              )}
              tracks={spotify.playlistTracks}
              loading={spotify.playlistTracksLoading}
              onBack={() => spotify.selectPlaylist(null)}
              onPlayTrack={handlePlayPlaylistTrack}
            />
          )}
        </div>
      </div>

      {/* Player bar - fixed at bottom */}
      <PlayerBar
        playbackState={spotify.playbackState}
        onPlay={spotify.play}
        onPause={spotify.pause}
        onNext={spotify.next}
        onPrevious={spotify.previous}
        onRefreshPlayback={spotify.refreshPlayback}
      />
    </div>
  )
}
