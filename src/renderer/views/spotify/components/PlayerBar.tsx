import {
  Disc3,
  Pause,
  Play,
  RefreshCw,
  SkipBack,
  SkipForward,
} from 'lucide-react'
import type { SpotifyPlaybackState } from '../../../../lib/types/spotify'

interface PlayerBarProps {
  playbackState: SpotifyPlaybackState
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrevious: () => void
  onRefreshPlayback: () => void
}

function msToMinutes(ms: number): string {
  const min = Math.floor(ms / 60000)
  const sec = Math.floor((ms % 60000) / 1000)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export function PlayerBar({
  playbackState,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onRefreshPlayback,
}: PlayerBarProps) {
  const { track, isPlaying, device } = playbackState
  const progressPct = playbackState.durationMs
    ? (playbackState.progressMs / playbackState.durationMs) * 100
    : 0

  return (
    <div className="fixed bottom-0 left-0 right-0 h-14 border-t border-border bg-background/95 backdrop-blur-sm flex items-center px-4 gap-3 z-50">
      {/* Track info */}
      <div className="flex items-center gap-2.5 min-w-0 w-64">
        {track?.album.images?.[2]?.url || track?.album.images?.[0]?.url ? (
          <img
            src={track.album.images[2]?.url || track.album.images[0]?.url || ''}
            alt={track?.album.name || ''}
            className="w-9 h-9 rounded object-cover shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded bg-muted flex items-center justify-center shrink-0">
            <Disc3 size={16} className="text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium truncate text-foreground">
            {track?.name || 'No track playing'}
          </p>
          {track && (
            <p className="text-[10px] text-muted-foreground truncate">
              {track.artists.map((a) => a.name).join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrevious}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted disabled:opacity-30"
          disabled={!track}
          title="Previous"
        >
          <SkipBack size={14} />
        </button>
        <button
          type="button"
          onClick={isPlaying ? onPause : onPlay}
          className="p-2 text-foreground hover:bg-muted transition-colors rounded-full disabled:opacity-30"
          disabled={!track}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause size={16} />
          ) : (
            <Play size={16} className="ml-0.5" />
          )}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted disabled:opacity-30"
          disabled={!track}
          title="Next"
        >
          <SkipForward size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex-1 mx-2 flex items-center gap-2 min-w-0">
        <span className="text-[10px] text-muted-foreground/50 w-8 text-right shrink-0">
          {track ? msToMinutes(playbackState.progressMs) : '--:--'}
        </span>
        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-1000"
            style={{ width: `${Math.min(progressPct, 100)}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground/50 w-8 shrink-0">
          {track ? msToMinutes(playbackState.durationMs) : '--:--'}
        </span>
      </div>

      {/* Device & refresh */}
      <div className="flex items-center gap-2 shrink-0">
        {device && (
          <span className="text-[10px] text-muted-foreground/50 truncate max-w-24">
            {device.name}
          </span>
        )}
        <button
          type="button"
          onClick={onRefreshPlayback}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
          title="Refresh playback state"
        >
          <RefreshCw size={12} />
        </button>
      </div>
    </div>
  )
}
