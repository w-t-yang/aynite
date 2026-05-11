import { ExternalLink, Play } from 'lucide-react'
import { cn } from '../../../shared/lib/utils'
import type {
  SpotifyRecentlyPlayedItem,
  SpotifySavedTrack,
} from '../../../../lib/types/spotify'

interface TimelineProps {
  recentlyPlayed: SpotifyRecentlyPlayedItem[]
  savedTracks: SpotifySavedTrack[]
  onPlayTrack: (uri: string) => void
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHrs < 24) return `${diffHrs}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function msToMinutes(ms: number): string {
  const min = Math.floor(ms / 60000)
  const sec = Math.floor((ms % 60000) / 1000)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function TrackRow({
  track,
  timestamp,
  label,
  onPlayTrack,
}: {
  track: SpotifyRecentlyPlayedItem['track']
  timestamp: string
  label: string
  onPlayTrack: (uri: string) => void
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: track row
    <div
      className="flex items-center gap-3 px-4 py-2.5 border-b border-border/20 hover:bg-accent/30 transition-colors group"
      onDoubleClick={() => onPlayTrack(track.uri)}
      onKeyDown={() => {}}
    >
      <div className="w-10 h-10 rounded object-cover shrink-0 relative">
        <img
          src={track.album.images?.[2]?.url || track.album.images?.[0]?.url || ''}
          alt={track.album.name}
          className="w-10 h-10 rounded object-cover"
        />
        <button
          type="button"
          onClick={() => onPlayTrack(track.uri)}
          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 rounded transition-opacity"
        >
          <Play size={14} className="text-white fill-white" />
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-foreground">
          {track.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {track.artists.map((a) => a.name).join(', ')}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground/50">{label}</span>
          <span className="text-[10px] text-muted-foreground/30">·</span>
          <span className="text-[10px] text-muted-foreground/50">
            {msToMinutes(track.durationMs)}
          </span>
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground/40 shrink-0">
        {formatRelativeTime(timestamp)}
      </div>
    </div>
  )
}

export function Timeline({ recentlyPlayed, savedTracks, onPlayTrack }: TimelineProps) {
  // Merge and sort by timestamp
  const merged: {
    type: 'played' | 'saved'
    track: SpotifyRecentlyPlayedItem['track']
    timestamp: string
    label: string
  }[] = [
    ...recentlyPlayed.map((r) => ({
      type: 'played' as const,
      track: r.track,
      timestamp: r.playedAt,
      label: 'Played',
    })),
    ...savedTracks.map((s) => ({
      type: 'saved' as const,
      track: s.track,
      timestamp: s.addedAt,
      label: 'Saved',
    })),
  ].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )

  if (merged.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <ExternalLink size={32} className="text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No listening history yet</p>
        <p className="text-xs text-muted-foreground/50 mt-1">
          Refresh to fetch your recently played tracks and saved songs.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-4">
      <div className="px-4 mb-4">
        <h2 className="text-base font-semibold text-foreground">Timeline</h2>
        <p className="text-xs text-muted-foreground">
          Your recent listening activity
        </p>
      </div>
      <div>
        {merged.map((item, i) => (
          <TrackRow
            key={`${item.type}-${item.track.id}-${item.timestamp}`}
            track={item.track}
            timestamp={item.timestamp}
            label={item.label}
            onPlayTrack={onPlayTrack}
          />
        ))}
      </div>
    </div>
  )
}
