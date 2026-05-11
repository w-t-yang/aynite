import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import type { SpotifyTopArtists } from '../../../../lib/types/spotify'
import { cn } from '../../../shared/lib/utils'

interface TopArtistsProps {
  topArtists: SpotifyTopArtists
}

type TimeRange = 'shortTerm' | 'mediumTerm' | 'longTerm'

const timeRangeLabels: Record<TimeRange, string> = {
  shortTerm: '4 Weeks',
  mediumTerm: '6 Months',
  longTerm: 'All Time',
}

export function TopArtists({ topArtists }: TopArtistsProps) {
  const [range, setRange] = useState<TimeRange>('mediumTerm')
  const artists = topArtists[range]

  if (artists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <ExternalLink size={32} className="text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No top artists yet</p>
        <p className="text-xs text-muted-foreground/50 mt-1">
          Refresh to fetch your top artists.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-4">
      <div className="px-4 mb-4">
        <h2 className="text-base font-semibold text-foreground">Top Artists</h2>
        {/* Time range selector */}
        <div className="flex items-center gap-1 mt-2">
          {(Object.keys(timeRangeLabels) as TimeRange[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={cn(
                'px-3 py-1 text-xs rounded-full transition-colors',
                range === key
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted',
              )}
            >
              {timeRangeLabels[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Artist grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 px-4">
        {artists.map((artist, i) => (
          <div
            key={artist.id}
            className="flex flex-col items-center p-3 rounded-lg hover:bg-accent/30 transition-colors group"
          >
            <div className="relative">
              <img
                src={artist.images?.[1]?.url || artist.images?.[0]?.url || ''}
                alt={artist.name}
                className="w-24 h-24 rounded-full object-cover shadow-md"
              />
              <div className="absolute -top-1 -left-1 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold shadow">
                {i + 1}
              </div>
            </div>
            <p className="text-sm font-medium text-foreground mt-2 text-center truncate w-full">
              {artist.name}
            </p>
            {artist.genres.length > 0 && (
              <p className="text-[10px] text-muted-foreground text-center truncate w-full">
                {artist.genres.slice(0, 2).join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
