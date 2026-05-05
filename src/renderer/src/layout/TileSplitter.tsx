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
    <div className={`splitter ${direction}`} onMouseDown={handleMouseDown} />
  )
}

export default TileSplitter
