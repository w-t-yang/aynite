import { FLEX_CENTER_GAP_2 } from '../../../lib/constants/renderer/styles'
import { Input } from '../basic/Input'

interface KeybindingRowProps {
  label: string
  value: string
  onChange: (value: string) => void
}

export function KeybindingRow({ label, value, onChange }: KeybindingRowProps) {
  return (
    <div className="flex items-center justify-between py-2 group hover:bg-accent/5 px-2 rounded-md transition-colors">
      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
        {label}
      </span>
      <div className={FLEX_CENTER_GAP_2}>
        <Input
          unstyled
          type="text"
          value={value}
          readOnly
          onKeyDown={(e) => {
            e.preventDefault()
            const keys = []
            if (e.ctrlKey) keys.push('Ctrl')
            if (e.metaKey) keys.push('Cmd')
            if (e.altKey) keys.push('Alt')
            if (e.shiftKey) keys.push('Shift')

            const key = e.key.toUpperCase()
            if (!['CONTROL', 'SHIFT', 'ALT', 'META'].includes(key)) {
              keys.push(key)
            }

            if (keys.length > 0) {
              onChange(keys.join('+'))
            }
          }}
          className="w-40 bg-accent/20 border border-transparent px-3 py-1.5 rounded text-xs font-mono text-center transition-all cursor-text placeholder:opacity-50"
          placeholder="Press keys..."
        />
      </div>
    </div>
  )
}
