import { useRef } from 'react'
import { useAppState } from '../../context/AppContext'
import { BOOST_OPTIONS } from '../../data/constants'
import type { StatKey, BoostKey } from '../../types'

interface Props {
  slotIndex: number
  statKey: StatKey
  statLabel: string
  spValue: number
  boostValue: number
  computedTotal: number
  isBoostable: boolean
}

export default function StatItem({
  slotIndex, statKey, statLabel, spValue, boostValue, computedTotal, isBoostable
}: Props) {
  const { dispatch } = useAppState()
  const spValRef = useRef<HTMLSpanElement>(null)

  function stepSP(delta: number, e: React.MouseEvent) {
    e.stopPropagation()
    const next = Math.max(0, Math.min(32, spValue + delta))
    if (next !== spValue) {
      dispatch({ type: 'UPDATE_SP', slot: slotIndex, stat: statKey, value: next })
    }
  }

  function commitSP() {
    if (!spValRef.current) return
    const val = Math.max(0, Math.min(32, parseInt(spValRef.current.textContent || '0') || 0))
    spValRef.current.textContent = String(val)
    dispatch({ type: 'UPDATE_SP', slot: slotIndex, stat: statKey, value: val })
  }

  function handleBoostChange(e: React.ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation()
    const val = e.target.value === '0' ? 0 : parseInt(e.target.value)
    dispatch({ type: 'UPDATE_BOOST', slot: slotIndex, stat: statKey as BoostKey, value: val })
  }

  const boostStr = boostValue > 0 ? '+' + boostValue : String(boostValue)
  const boostClass = boostValue > 0 ? ' boosted' : boostValue < 0 ? ' dropped' : ''

  return (
    <div className="stat-item">
      <span className="stat-label">{statLabel}</span>
      <div className="sp-spinner">
        <button className="sp-btn" onClick={e => stepSP(1, e)}>▲</button>
        <div className="sp-val-wrap">
          <span
            ref={spValRef}
            className="stat-val"
            contentEditable
            suppressContentEditableWarning
            onBlur={commitSP}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur() } }}
            onClick={e => e.stopPropagation()}
          >
            {spValue}
          </span>
          <span className="stat-total">{computedTotal}</span>
        </div>
        <button className="sp-btn" onClick={e => stepSP(-1, e)}>▼</button>
      </div>
      {isBoostable && (
        <select
          className={'stat-boost-sel' + boostClass}
          value={boostStr}
          onChange={handleBoostChange}
          onClick={e => e.stopPropagation()}
        >
          {BOOST_OPTIONS.map(v => (
            <option key={v} value={v}>{v === '0' ? '±0' : v}</option>
          ))}
        </select>
      )}
    </div>
  )
}
