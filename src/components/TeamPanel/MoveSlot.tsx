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

  const dotColor = value && MOVE_DATA[value]
    ? `var(--${MOVE_DATA[value].type})`
    : 'var(--muted)'

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation()
    dispatch({ type: 'UPDATE_MOVE', slot: slotIndex, moveIdx, value: e.target.value })
  }

  return (
    <div className="move-slot">
      <div className="move-type-dot" style={{ background: dotColor }} />
      <select value={value} onChange={handleChange} onClick={e => e.stopPropagation()}>
        <option value="">(Aucun)</option>
        {moves.map(m => {
          const pct = m.percent > 0 ? ` (${Math.floor(m.percent * 10) / 10}%)` : ''
          return <option key={m.move.name} value={m.move.name}>{m.move.name}{pct}</option>
        })}
      </select>
    </div>
  )
}
