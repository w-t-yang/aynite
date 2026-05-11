import { useState } from 'react'
import { Button } from '../../../shared/basic/Button'
import { Input } from '../../../shared/basic/Input'
import { Modal } from '../../../shared/basic/Modal'
import { cn } from '../../../shared/lib/utils'
import type { RssGroup } from '../types'

interface AddSourceModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (url: string, groupId: string) => void
  groups: RssGroup[]
}

export function AddSourceModal({
  isOpen,
  onClose,
  onSubmit,
  groups,
}: AddSourceModalProps) {
  const [url, setUrl] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    groups[0]?.id || '',
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (url.trim() && selectedGroupId) {
      onSubmit(url.trim(), selectedGroupId)
      setUrl('')
      onClose()
    }
  }

  const handleClose = () => {
    setUrl('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Feed" size="md">
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
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            type="submit"
            disabled={!url.trim() || !selectedGroupId}
          >
            Add Feed
          </Button>
        </div>
      </form>
    </Modal>
  )
}
