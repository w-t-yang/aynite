import { useState } from 'react'
import { Button } from '../../../shared/basic/Button'
import { Input } from '../../../shared/basic/Input'
import { Modal } from '../../../shared/basic/Modal'
import { cn } from '../../../shared/lib/utils'
import type { RssGroup, RssSource } from '../types'

interface EditSourceModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (
    sourceId: string,
    updates: { url: string; groupId: string },
  ) => void
  source: RssSource
  groups: RssGroup[]
}

export function EditSourceModal({
  isOpen,
  onClose,
  onSubmit,
  source,
  groups,
}: EditSourceModalProps) {
  const [url, setUrl] = useState(source.url)
  const [selectedGroupId, setSelectedGroupId] = useState(source.groupId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (url.trim()) {
      onSubmit(source.id, { url: url.trim(), groupId: selectedGroupId })
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit: ${source.title || source.url}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          autoFocus
          label="Feed URL"
          value={url}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setUrl(e.target.value)
          }
          placeholder="https://example.com/rss"
        />

        <div>
          <span className="text-xs font-medium text-muted-foreground mb-2 block">
            Group
          </span>
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelectedGroupId(group.id)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-md border transition-colors',
                  selectedGroupId === group.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent',
                )}
              >
                {group.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            type="submit"
            disabled={!url.trim()}
          >
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}
