'use client'

import { useAppState } from '../../context/AppContext'
import { MOVE_DATA } from '../../data/moveData'
import { getMoveDesc } from '../../hooks/useMoveDesc'
import { getMoveMeta } from '../../hooks/useMoveIndex'
import type { CCMoveEntry } from '../../calc/teamHelpers'
import SearchSelect from './SearchSelect'
import type { SearchOption } from './SearchSelect'

const CAT_SHORT: Record<string, string> = { Physical: 'PHY', Special: 'SPC', Status: 'STA' }

interface Props {
  slotIndex: number
  moveIdx: number
  value: string
  moves: CCMoveEntry[]
}

export default function MoveSlot({ slotIndex, moveIdx, value, moves }: Props) {
  const { dispatch } = useAppState()

  const staticMd = value ? MOVE_DATA[value] : null
  const ccMeta = value && !staticMd ? getMoveMeta(value) : null
  const md = staticMd ?? ccMeta ?? null

  const dotColor = md ? `var(--${md.type})` : 'var(--muted)'
  const catShort = md?.category ? CAT_SHORT[md.category] : null
  const bp = md && 'bp' in md && (md as { bp?: number }).bp && (md as { bp?: number }).bp! > 1
    ? (md as { bp?: number }).bp!
    : null

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
        getDescription={getMoveDesc}
      />
      {catShort && (
        <span className="move-cat-badge" style={{ color: dotColor }}>
          {catShort}{bp ? ` ${bp}` : ''}
        </span>
      )}
    </div>
  )
}
