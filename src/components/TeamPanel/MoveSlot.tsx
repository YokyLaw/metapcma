'use client'

import { useMemo } from 'react'
import { useAppState } from '../../context/AppContext'
import { MOVE_DATA } from '../../data/moveData'
import { getMoveDesc } from '../../hooks/useMoveDesc'
import { getMoveMeta } from '../../hooks/useMoveIndex'
import { buildCalcCtx, calcOneMoveResult } from '../../calc/damageCalc'
import { getStats } from '../../calc/statCalc'
import { POKE_DATA } from '../../data/pokeData'
import { getEffectivePokeName } from '../../calc/teamHelpers'
import type { CCMoveEntry } from '../../calc/teamHelpers'
import type { StatMap } from '../../types'
import SearchSelect from './SearchSelect'
import type { SearchOption } from './SearchSelect'

interface Props {
  slotIndex: number
  moveIdx: number
  value: string
  moves: CCMoveEntry[]
}

export default function MoveSlot({ slotIndex, moveIdx, value, moves }: Props) {
  const { state, dispatch } = useAppState()
  const slot = state.team[slotIndex]
  const advName = state.matchupAdvName
  const advOverride = advName ? (state.advStats[advName] ?? null) : null

  const calcCtx = useMemo(() => {
    if (!advName || !slot.pokemon) return null
    const atkPokeData = POKE_DATA[getEffectivePokeName(slot)]
    const defPokeData = POKE_DATA[advName]
    if (!atkPokeData || !defPokeData) return null
    const atkStats = getStats(atkPokeData, slot.sps as StatMap, slot.natPlus, slot.natMinus)
    return buildCalcCtx(slot, atkStats, defPokeData, advOverride, state.weather, state.terrain)
  }, [
    slot.pokemon, slot.megaForme, slot.ability, slot.item,
    slot.natPlus, slot.natMinus,
    slot.sps.hp, slot.sps.at, slot.sps.df, slot.sps.sa, slot.sps.sd, slot.sps.sp,
    slot.boosts.at, slot.boosts.df, slot.boosts.sa, slot.boosts.sd, slot.boosts.sp,
    advName, advOverride, state.weather, state.terrain,
  ])

  function getDamage(moveName: string): string | undefined {
    if (!calcCtx || !moveName) return undefined
    const r = calcOneMoveResult(moveName, calcCtx)
    if (!r || r.maxPct === 0) return undefined
    if (r.minPct >= 100) return 'OHKO'
    const min = (Math.floor(r.minPct * 10) / 10).toFixed(1)
    const max = (Math.floor(r.maxPct * 10) / 10).toFixed(1)
    return min === max ? `${min}%` : `${min}~${max}%`
  }

  const staticMd = value ? MOVE_DATA[value] : null
  const ccMeta = value && !staticMd ? getMoveMeta(value) : null
  const md = staticMd ?? ccMeta ?? null
  const dotColor = md ? `var(--${md.type})` : 'var(--muted)'

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
        getMeta={calcCtx ? getDamage : undefined}
      />
    </div>
  )
}
