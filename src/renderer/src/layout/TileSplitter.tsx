import type React from 'react'
import { useEffect, useRef } from 'react'

interface TileSplitterProps {
  direction: 'horizontal' | 'vertical'
  onResize: (delta: number) => void
  onResizeStart?: () => void
  onResizeEnd?: () => void
}

const TileSplitter: React.FC<TileSplitterProps> = ({
  direction,
  onResize,
  onResizeStart,
  onResizeEnd,
}) => {
  // Use a ref to always have the latest callback without re-binding listeners
  const onResizeRef = useRef(onResize)
  useEffect(() => {
    onResizeRef.current = onResize
  }, [onResize])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    onResizeStart?.()

    const startPos = direction === 'horizontal' ? e.clientX : e.clientY
    let lastPos = startPos

    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentPos =
        direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY
      const incrementalDelta = currentPos - lastPos

      // Only trigger if there's actual movement
      if (incrementalDelta !== 0) {
        lastPos = currentPos
        onResizeRef.current(incrementalDelta)
      }
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      onResizeEnd?.()
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: <hr> gets height:0 from Tailwind preflight, breaking the splitter
    <div
      onMouseDown={handleMouseDown}
      role="separator"
      tabIndex={-1}
      aria-orientation={direction}
      aria-valuenow={50}
      className={`splitter ${direction} m-0 p-0 flex-shrink-0`}
      style={{ flex: '0 0 auto', zIndex: 200 }}
    />
  )
}

export default TileSplitter
