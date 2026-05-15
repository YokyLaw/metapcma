'use client'

import { useState, useRef, useLayoutEffect, type CSSProperties } from 'react'
import type { MouseEvent } from 'react'

const TOOLTIP_W = 260
const MEASURING_STYLE: CSSProperties = { visibility: 'hidden', top: 0, left: 0, width: TOOLTIP_W }

export interface TooltipState {
  text: string
  anchor: { top: number; bottom: number; left: number; right: number }
  style: CSSProperties
}

export function useDescTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLayoutEffect(() => {
    if (!tooltip || tooltip.style !== MEASURING_STYLE || !tooltipRef.current) return
    const h = tooltipRef.current.offsetHeight
    const { top, bottom, left, right } = tooltip.anchor
    const clampedLeft = Math.min(left, window.innerWidth - TOOLTIP_W - 8)
    const spaceBelow = window.innerHeight - bottom - 8
    const spaceRight = window.innerWidth - right - 8
    const raisedTop = Math.max(8, window.innerHeight - 8 - h)
    let style: CSSProperties
    if (spaceBelow >= h) {
      style = { top: bottom + 4, left: clampedLeft, width: TOOLTIP_W }
    } else if (spaceRight >= TOOLTIP_W) {
      style = { top: raisedTop, left: right + 6, width: TOOLTIP_W }
    } else {
      style = { top: raisedTop, left: left - TOOLTIP_W - 6, width: TOOLTIP_W }
    }
    setTooltip(prev => prev ? { ...prev, style } : null)
  }, [tooltip])

  function handleEnter(e: MouseEvent<HTMLElement>, desc: string) {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
    const rect = e.currentTarget.getBoundingClientRect()
    tooltipTimer.current = setTimeout(() => {
      setTooltip({
        text: desc,
        anchor: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
        style: MEASURING_STYLE,
      })
    }, 250)
  }

  function handleLeave() {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
    setTooltip(null)
  }

  return { tooltip, tooltipRef, handleEnter, handleLeave }
}
