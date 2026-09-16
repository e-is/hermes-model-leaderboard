import { useEffect, useRef, useState } from 'react'

/**
 * useResizable — hook pour rendre un panneau latéral redimensionnable par drag.
 *
 * Usage:
 *   const { width, onMouseDown } = useResizable({ initial: 360, min: 280, max: 600 })
 *   <div style={{ width }}>...</div>
 *   <div onMouseDown={onMouseDown} style={{ cursor: 'col-resize', width: 4 }} />
 */
export function useResizable(opts: { initial: number; min: number; max: number; storageKey?: string }) {
  const { initial, min, max, storageKey } = opts
  const [width, setWidth] = useState<number>(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const v = parseInt(saved, 10)
        if (!isNaN(v) && v >= min && v <= max) return v
      }
    }
    return initial
  })
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      e.preventDefault()
      const delta = e.clientX - startX.current
      // Panel sits on the RIGHT of the handle: dragging LEFT (delta < 0) must
      // WIDEN it, so width moves opposite to the cursor.
      const next = Math.min(max, Math.max(min, startWidth.current - delta))
      setWidth(next)
    }
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        if (storageKey) {
          setWidth(w => {
            localStorage.setItem(storageKey, String(w))
            return w
          })
        }
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [max, min, storageKey])

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return { width, onMouseDown }
}