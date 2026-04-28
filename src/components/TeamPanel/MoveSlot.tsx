'use client'

import { useState, useRef, useEffect } from 'react'
import { useAppState } from '../../context/AppContext'
import { MOVE_DATA } from '../../data/moveData'
import type { CCMoveEntry } from '../../calc/teamHelpers'

interface Props {
  slotIndex: number
  moveIdx: number
  value: string
  moves: CCMoveEntry[]
}

export default function MoveSlot({ slotIndex, moveIdx, value, moves }: Props) {
  const { dispatch } = useAppState()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const dotColor = value && MOVE_DATA[value]
    ? `var(--${MOVE_DATA[value].type})`
    : 'var(--muted)'

  const allOptions: CCMoveEntry[] = [
    { move: { name: '' }, percent: 0 },
    ...moves,
  ]

  function select(name: string) {
    dispatch({ type: 'UPDATE_MOVE', slot: slotIndex, moveIdx, value: name })
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const label = value || '(Aucun)'

  return (
    <div
      className="move-slot"
      ref={ref}
      onClick={e => e.stopPropagation()}
    >
      <div className="move-type-dot" style={{ background: dotColor }} />
      <button
        className="move-dropdown-trigger"
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        type="button"
      >
        <span className="move-dropdown-label">{label}</span>
        <span className="move-dropdown-arrow">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <ul className="move-dropdown-list" onClick={e => e.stopPropagation()}>
          {allOptions.map(m => {
            const name = m.move.name
            const pct = m.percent > 0 ? `${Math.floor(m.percent * 10) / 10}%` : null
            const active = name === value
            return (
              <li
                key={name || '__none__'}
                className={`move-dropdown-item${active ? ' active' : ''}`}
                onMouseDown={() => select(name)}
              >
                <span>{name || '(Aucun)'}</span>
                {pct && <span className="move-dropdown-pct">{pct}</span>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
