'use client'

import { useState, useEffect, useRef } from 'react'
import type React from 'react'

export function useGroupPanel() {
  const containerRef   = useRef<HTMLDivElement>(null)
  const isDraggingRef  = useRef(false)
  const panelWidthRef  = useRef(30)
  const [panelWidth, setPanelWidth] = useState(30)
  const [isDesktop, setIsDesktop]   = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('groups_panel_width')
    if (stored) {
      const w = Number(stored)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (w >= 15 && w <= 45) { setPanelWidth(w); panelWidthRef.current = w }
    }
    const mq = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function handleDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    isDraggingRef.current = true
    function onMouseMove(ev: MouseEvent) {
      if (!isDraggingRef.current || !containerRef.current) return
      const rect   = containerRef.current.getBoundingClientRect()
      const minPct = (250 / rect.width) * 100
      const newW   = Math.max(minPct, Math.min(45, ((ev.clientX - rect.left) / rect.width) * 100))
      panelWidthRef.current = newW
      setPanelWidth(newW)
    }
    function onMouseUp() {
      isDraggingRef.current = false
      localStorage.setItem('groups_panel_width', String(Math.round(panelWidthRef.current)))
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function handleDividerDoubleClick() {
    setPanelWidth(prev => {
      const next = prev < 25 ? 30 : prev < 35 ? 40 : 20
      panelWidthRef.current = next
      localStorage.setItem('groups_panel_width', String(next))
      return next
    })
  }

  return { containerRef, panelWidth, isDesktop, handleDividerMouseDown, handleDividerDoubleClick }
}
