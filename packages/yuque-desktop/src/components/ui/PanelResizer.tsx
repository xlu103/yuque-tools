import { useCallback, useRef, useEffect, useState } from 'react'

interface PanelResizerProps {
  /** 拖动方向 */
  direction?: 'horizontal' | 'vertical'
  /** 拖动时的回调，返回位移量 */
  onResize: (delta: number) => void
  /** 拖动结束时的回调 */
  onResizeEnd?: () => void
  /** 自定义样式类名 */
  className?: string
}

export function PanelResizer({
  direction = 'horizontal',
  onResize,
  onResizeEnd,
  className = ''
}: PanelResizerProps) {
  const [isDragging, setIsDragging] = useState(false)
  const startPosRef = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY
  }, [direction])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY
      const delta = currentPos - startPosRef.current
      startPosRef.current = currentPos
      onResize(delta)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      onResizeEnd?.()
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, direction, onResize, onResizeEnd])

  const isHorizontal = direction === 'horizontal'

  return (
    <div
      className={`
        flex-shrink-0 relative group
        ${isHorizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
        ${isDragging ? 'bg-accent' : 'bg-transparent hover:bg-accent/30'}
        transition-colors duration-150
        ${className}
      `}
      onMouseDown={handleMouseDown}
    >
      {/* Larger hit area for easier grabbing */}
      <div
        className={`
          absolute
          ${isHorizontal 
            ? 'top-0 bottom-0 -left-1 -right-1 w-3' 
            : 'left-0 right-0 -top-1 -bottom-1 h-3'
          }
        `}
      />
      {/* Visual indicator line */}
      <div
        className={`
          absolute
          ${isHorizontal
            ? 'top-0 bottom-0 left-0 w-px bg-border group-hover:bg-accent'
            : 'left-0 right-0 top-0 h-px bg-border group-hover:bg-accent'
          }
          ${isDragging ? 'bg-accent' : ''}
          transition-colors duration-150
        `}
      />
    </div>
  )
}
