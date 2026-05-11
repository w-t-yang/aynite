import { ExternalLink, Play } from 'lucide-react'
import type { SpotifyPlaylist } from '../../../../lib/types/spotify'

interface PlaylistsProps {
  playlists: SpotifyPlaylist[]
  onSelectPlaylist: (id: string) => void
  onPlayPlaylist: (uri: string) => void
}

export function Playlists({
  playlists,
  onSelectPlaylist,
  onPlayPlaylist,
}: PlaylistsProps) {
  if (playlists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <ExternalLink size={32} className="text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No playlists found</p>
        <p className="text-xs text-muted-foreground/50 mt-1">
          Refresh to fetch your playlists.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-4">
      <div className="px-4 mb-4">
        <h2 className="text-base font-semibold text-foreground">Playlists</h2>
        <p className="text-xs text-muted-foreground">
          {playlists.length} playlists
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 px-4">
        {playlists.map((playlist) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: clickable playlist card
          <div
            key={playlist.id}
            className="flex flex-col p-3 rounded-lg hover:bg-accent/30 transition-colors group cursor-pointer"
            onClick={() => onSelectPlaylist(playlist.id)}
            onKeyDown={() => {}}
          >
            <div className="relative">
              <img
                src={playlist.images?.[0]?.url || ''}
                alt={playlist.name}
                className="w-full aspect-square rounded-md object-cover shadow-sm"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onPlayPlaylist(playlist.uri)
                }}
                className="absolute bottom-2 right-2 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:scale-105"
              >
                <Play size={18} className="fill-white ml-0.5" />
              </button>
            </div>
            <p className="text-sm font-medium text-foreground mt-2 truncate">
              {playlist.name}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {playlist.tracks.total} tracks
              {playlist.owner.displayName && ` · ${playlist.owner.displayName}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
