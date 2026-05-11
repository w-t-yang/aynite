import {
  type Disc3,
  Headphones,
  Library,
  ListMusic,
  TrendingUp,
} from 'lucide-react'
import type { SpotifyProfile } from '../../../../lib/types/spotify'
import { cn } from '../../../shared/lib/utils'
import type { Section } from '../SpotifyApp'

interface SidebarProps {
  profile: SpotifyProfile | null
  section: Section
  onSectionChange: (section: Section) => void
  onRefresh: () => void
}

const navItems: {
  id: Section
  label: string
  icon: typeof Disc3
}[] = [
  { id: 'timeline', label: 'Timeline', icon: Headphones },
  { id: 'saved', label: 'Saved Tracks', icon: Library },
  { id: 'artists', label: 'Top Artists', icon: TrendingUp },
  { id: 'playlists', label: 'Playlists', icon: ListMusic },
]

export function Sidebar({
  profile,
  section,
  onSectionChange,
  onRefresh: _onRefresh,
}: SidebarProps) {
  return (
    <div className="w-56 shrink-0 border-r border-border flex flex-col bg-sidebar/50">
      {/* Profile card */}
      {profile && (
        <div className="p-3 border-b border-border/40 flex items-center gap-3">
          {profile.images?.[0]?.url && (
            <img
              src={profile.images[0].url}
              alt={profile.displayName}
              className="w-10 h-10 rounded-full object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate text-foreground">
              {profile.displayName}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {profile.followers.toLocaleString()} followers
            </p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="p-2 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = section === item.id
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: navigation item
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-xs rounded-md cursor-pointer transition-colors mb-0.5',
                isActive
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
              onClick={() => onSectionChange(item.id)}
              onKeyDown={() => {}}
            >
              <Icon size={14} />
              {item.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}
