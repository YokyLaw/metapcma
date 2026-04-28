import { useEffect, useRef } from 'react'
import { useAppState } from '../context/AppContext'
import { POKE_DATA } from '../data/pokeData'
import { USAGE_MAP } from '../data/usageData'
import { getStats } from '../calc/statCalc'
import { getEffectivePokeName } from '../calc/teamHelpers'
import { buildTableRow } from '../calc/damageCalc'
import type { TableRow } from '../types'

export function useCalc() {
  const { state, dispatch } = useAppState()
  const { team, selectedSlot, weather, terrain, advStats } = state
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const slot = selectedSlot !== null ? team[selectedSlot] : null

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      if (selectedSlot === null || !slot?.pokemon) {
        dispatch({ type: 'SET_TABLE_DATA', tableData: [] })
        return
      }

      const effectiveName = getEffectivePokeName(slot)
      const atkPokeData = POKE_DATA[effectiveName]
      if (!atkPokeData) {
        dispatch({ type: 'SET_TABLE_DATA', tableData: [] })
        return
      }

      const validMoves = slot.moves.filter(m => m)
      if (validMoves.length === 0) {
        dispatch({ type: 'SET_TABLE_DATA', tableData: [] })
        return
      }

      const atkStats = getStats(atkPokeData, slot.sps, slot.natPlus, slot.natMinus)
      const tableData: TableRow[] = []

      for (const [defName, defData] of Object.entries(POKE_DATA)) {
        if (!defData?.bs) continue
        const row = buildTableRow(slot, atkStats, defName, defData, advStats, weather, terrain)
        if (!row) continue
        row.usage = USAGE_MAP[defName] ?? -1
        tableData.push(row)
      }

      dispatch({ type: 'SET_TABLE_DATA', tableData })
    }, 150)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [
    selectedSlot,
    slot?.pokemon,
    slot?.megaForme,
    slot?.ability,
    slot?.item,
    slot?.natPlus,
    slot?.natMinus,
    slot?.sps,
    slot?.boosts,
    slot?.moves,
    weather,
    terrain,
    advStats,
  ])
}
