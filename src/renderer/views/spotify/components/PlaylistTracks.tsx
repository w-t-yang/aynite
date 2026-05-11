import { ArrowLeft, ExternalLink, Loader2, Play } from 'lucide-react'
import type { SpotifyPlaylist, SpotifyPlaylistTrackItem } from '../../../../lib/types/spotify'

interface PlaylistTracksProps {
  playlist: SpotifyPlaylist | undefined
  tracks: SpotifyPlaylistTrackItem[]
  loading: boolean
  onBack: () => void
  onPlayTrack: (uri: string) => void
}

function msToMinutes(ms: number): string {
  const min = Math.floor(ms / 60000)
  const sec = Math.floor((ms % 60000) / 1000)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export function PlaylistTracks({
  playlist,
  tracks,
  loading,
  onBack,
  onPlayTrack,
}: PlaylistTracksProps) {
  if (!playlist) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <ExternalLink size={32} className="text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">Playlist not found</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-4">
        <div className="px-4 mb-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft size={14} />
            Back to playlists
          </button>
          <div className="flex items-center gap-4">
            {playlist.images?.[0]?.url && (
              <img
                src={playlist.images[0].url}
                alt={playlist.name}
                className="w-16 h-16 rounded-md object-cover shadow-sm"
              />
            )}
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {playlist.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                {playlist.tracks.total} tracks
                {playlist.owner.displayName &&
                  ` · by ${playlist.owner.displayName}`}
              </p>
              {playlist.description && (
                <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">
                  {playlist.description}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 size={16} className="animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-4">
      {/* Back button + header */}
      <div className="px-4 mb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft size={14} />
          Back to playlists
        </button>
        <div className="flex items-center gap-4">
          {playlist.images?.[0]?.url && (
            <img
              src={playlist.images[0].url}
              alt={playlist.name}
              className="w-16 h-16 rounded-md object-cover shadow-sm"
            />
          )}
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {playlist.name}
            </h2>
            <p className="text-xs text-muted-foreground">
              {tracks.length} of {playlist.tracks.total} tracks
              {playlist.owner.displayName &&
                ` · by ${playlist.owner.displayName}`}
            </p>
            {playlist.description && (
              <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">
                {playlist.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Track list */}
      <div>
        <div className="flex items-center gap-3 px-4 py-1.5 text-[10px] text-muted-foreground/50 uppercase tracking-wider border-b border-border/20">
          <span className="w-10" />
          <span className="flex-1">Title</span>
          <span className="w-12 text-right">Duration</span>
        </div>
        {tracks.map((item) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: track row
          <div
            key={item.track.id}
            className="flex items-center gap-3 px-4 py-2 border-b border-border/20 hover:bg-accent/30 transition-colors group"
            onDoubleClick={() => onPlayTrack(item.track.uri)}
            onKeyDown={() => {}}
          >
            <div className="w-10 shrink-0 relative">
              <img
                src={
                  item.track.album.images?.[2]?.url ||
                  item.track.album.images?.[0]?.url ||
                  ''
                }
                alt={item.track.album.name}
                className="w-10 h-10 rounded object-cover"
              />
              <button
                type="button"
                onClick={() => onPlayTrack(item.track.uri)}
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 rounded transition-opacity"
              >
                <Play size={14} className="text-white fill-white" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">
                {item.track.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {item.track.artists.map((a) => a.name).join(', ')}
              </p>
            </div>
            <span className="w-12 text-right text-[10px] text-muted-foreground/50 shrink-0">
              {msToMinutes(item.track.durationMs)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
