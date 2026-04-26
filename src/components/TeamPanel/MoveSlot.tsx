import { useAppState } from '../../context/AppContext'
import { MOVE_DATA } from '../../data/moveData'

interface Props {
  slotIndex: number
  moveIdx: number
  value: string
  movePool: string[]
  movePercent: Record<string, number>
}

export default function MoveSlot({ slotIndex, moveIdx, value, movePool, movePercent }: Props) {
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
        {movePool.map(n => {
          const pct = movePercent[n] != null ? ` (${Math.floor(movePercent[n] * 10) / 10}%)` : ''
          return <option key={n} value={n}>{n}{pct}</option>
        })}
      </select>
    </div>
  )
}
