import { ExternalLink, Play } from 'lucide-react'
import { cn } from '../../../shared/lib/utils'
import type { SpotifySavedTrack } from '../../../../lib/types/spotify'

interface SavedTracksProps {
  tracks: SpotifySavedTrack[]
  onPlayTrack: (uri: string) => void
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function msToMinutes(ms: number): string {
  const min = Math.floor(ms / 60000)
  const sec = Math.floor((ms % 60000) / 1000)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export function SavedTracks({ tracks, onPlayTrack }: SavedTracksProps) {
  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <ExternalLink size={32} className="text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No saved tracks yet</p>
        <p className="text-xs text-muted-foreground/50 mt-1">
          Refresh to fetch your saved songs.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-4">
      <div className="px-4 mb-4">
        <h2 className="text-base font-semibold text-foreground">
          Saved Tracks
        </h2>
        <p className="text-xs text-muted-foreground">
          {tracks.length} liked songs
        </p>
      </div>
      <div>
        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-1.5 text-[10px] text-muted-foreground/50 uppercase tracking-wider border-b border-border/20">
          <span className="w-10" />
          <span className="flex-1">Title</span>
          <span className="w-16 text-right">Added</span>
          <span className="w-12 text-right">Duration</span>
        </div>
        {tracks.map((saved) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: track row
          <div
            key={saved.track.id}
            className="flex items-center gap-3 px-4 py-2 border-b border-border/20 hover:bg-accent/30 transition-colors group"
            onDoubleClick={() => onPlayTrack(saved.track.uri)}
            onKeyDown={() => {}}
          >
            <div className="w-10 shrink-0 relative">
              <img
                src={
                  saved.track.album.images?.[2]?.url ||
                  saved.track.album.images?.[0]?.url ||
                  ''
                }
                alt={saved.track.album.name}
                className="w-10 h-10 rounded object-cover"
              />
              <button
                type="button"
                onClick={() => onPlayTrack(saved.track.uri)}
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 rounded transition-opacity"
              >
                <Play size={14} className="text-white fill-white" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">
                {saved.track.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {saved.track.artists.map((a) => a.name).join(', ')}
              </p>
            </div>
            <span className="w-16 text-right text-[10px] text-muted-foreground/50 shrink-0">
              {formatDate(saved.addedAt)}
            </span>
            <span className="w-12 text-right text-[10px] text-muted-foreground/50 shrink-0">
              {msToMinutes(saved.track.durationMs)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
