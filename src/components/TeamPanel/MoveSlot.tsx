'use client'

import { useAppState } from '../../context/AppContext'
import { MOVE_DATA } from '../../data/moveData'
import type { CCMoveEntry } from '../../calc/teamHelpers'
import SearchSelect from './SearchSelect'
import type { SearchOption } from './SearchSelect'

interface Props {
  slotIndex: number
  moveIdx: number
  value: string
  moves: CCMoveEntry[]
}

export default function MoveSlot({ slotIndex, moveIdx, value, moves }: Props) {
  const { dispatch } = useAppState()

  const dotColor = value && MOVE_DATA[value]
    ? `var(--${MOVE_DATA[value].type})`
    : 'var(--muted)'

  const options: SearchOption[] = moves.map(m => ({
    value: m.move.name,
    label: m.move.name,
    meta: m.percent > 0 ? `${Math.floor(m.percent * 10) / 10}%` : undefined,
  }))

  return (
    <div className="move-slot">
      <div className="move-type-dot" style={{ background: dotColor }} />
      <SearchSelect
        value={value}
        options={options}
        onChange={v => dispatch({ type: 'UPDATE_MOVE', slot: slotIndex, moveIdx, value: v })}
        placeholder="(Aucun)"
      />
    </div>
  )
}
