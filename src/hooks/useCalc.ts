import { useEffect, useRef } from 'react'
import { useAppState } from '../context/AppContext'
import { POKE_DATA } from '../data/pokeData'
import { getUsage, useUsageLoaded } from './useUsageData'
import { getStats } from '../calc/statCalc'
import { getEffectivePokeName, getPokeNameFromId } from '../calc/teamHelpers'
import { buildTableRow } from '../calc/damageCalc'
import { extractName } from './useCC'
import type { TableRow } from '../types'

export function useCalc() {
  const { state, dispatch } = useAppState()
  const { team, selectedSlot, weather, terrain, advStats, advItems, gravity, battleFormat, tailwind, helpingHand, auroraVeil, reflect, lightScreen, advAuroraVeil, advReflect, advLightScreen, matchupCalcList } = state
  const usageLoaded = useUsageLoaded()
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
        const fullDefItem = extractName((advItems[defName] as unknown) || '')
        const row = buildTableRow(slot, atkStats, defName, defData, {}, weather, terrain, gravity, battleFormat === 'doubles', undefined, helpingHand, advAuroraVeil, advReflect, advLightScreen, tailwind, fullDefItem)
        if (!row) continue
        row.usage = getUsage(defName)
        tableData.push(row)
      }

      dispatch({ type: 'SET_TABLE_DATA', tableData })

      const matchupRows: TableRow[] = matchupCalcList.flatMap(id => {
        const pokeName = getPokeNameFromId(id)
        const defData = POKE_DATA[pokeName]
        if (!defData?.bs) return []
        const idAdv = advStats[id]
        const idAdvStats = idAdv ? { [pokeName]: idAdv } : {}
        const defItem = extractName((advItems[id] as unknown) || '')
        const row = buildTableRow(slot, atkStats, pokeName, defData, idAdvStats, weather, terrain, gravity, battleFormat === 'doubles', undefined, helpingHand, advAuroraVeil, advReflect, advLightScreen, tailwind, defItem)
        if (!row) return []
        row.id = id
        row.usage = getUsage(pokeName)
        return [row]
      })
      dispatch({ type: 'SET_MATCHUP_ROWS', matchupRows })
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
    gravity,
    tailwind,
    battleFormat,
    helpingHand,
    auroraVeil,
    reflect,
    lightScreen,
    advAuroraVeil,
    advReflect,
    advLightScreen,
    advStats,
    advItems,
    matchupCalcList,
    usageLoaded,
  ])
}
