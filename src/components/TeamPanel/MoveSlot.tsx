'use client'

import { useAppState } from '../../context/AppContext'
import { getMoveDesc } from '../../hooks/useMoveMeta'
import { getMoveData } from '../../calc/moveHelpers'
import { extractName } from '../../hooks/useCC'
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

  const md = value ? getMoveData(value) : null
  const dotColor = md ? `var(--${md.type})` : 'var(--muted)'

  const options: SearchOption[] = moves.map(m => {
    const moveName = extractName(m.move.name as unknown)
    return {
      value: moveName,
      label: moveName,
      meta: m.percent > 0 ? `${Math.floor(m.percent * 10) / 10}%` : undefined,
    }
  })

  return (
    <div className="move-slot">
      <div className="move-type-dot" style={{ background: dotColor }} />
      <SearchSelect
        value={extractName(value as unknown)}
        options={options}
        onChange={v => dispatch({ type: 'UPDATE_MOVE', slot: slotIndex, moveIdx, value: v })}
        placeholder="(Aucun)"
        getDescription={getMoveDesc}
      />
    </div>
  )
}
