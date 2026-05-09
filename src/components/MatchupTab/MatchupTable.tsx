import { useCallback, useMemo } from 'react'
import { useAppState } from '../../context/AppContext'
import type { TableRow } from '../../types'
import DamageRow from '../ResultsPanel/DamageRow'

interface ExtendedRow extends TableRow {
  id: string
  spHP?: number; spDf?: number; spSd?: number
  spSp?: number; spAt?: number; spSa?: number
  advNatPlus?: string; advNatMinus?: string; advAbility?: string
}

export default function MatchupTable() {
  const { state, dispatch } = useAppState()
  const { matchupRows, advStats, matchupAdvName, matchupCalcList } = state

  const sorted: ExtendedRow[] = useMemo(() => {
    const enriched: ExtendedRow[] = matchupRows.map(row => {
      const id = row.id!
      const adv = advStats[id] || {}
      return {
        ...row,
        id,
        spHP: adv.sp_hp ?? 0,
        spDf: adv.sp_df ?? 0,
        spSd: adv.sp_sd ?? 0,
        spSp: adv.sp_sp ?? 0,
        spAt: adv.sp_at ?? 0,
        spSa: adv.sp_sa ?? 0,
        advNatPlus: adv.natPlus || '',
        advNatMinus: adv.natMinus || '',
        advAbility: adv.ability || '',
      }
    })
    return enriched.sort((a, b) => {
      if (matchupAdvName) {
        if (a.id === matchupAdvName) return -1
        if (b.id === matchupAdvName) return 1
      }
      return (b.usage ?? 0) - (a.usage ?? 0)
    })
  }, [matchupRows, advStats, matchupAdvName])

  const handleSelect = useCallback((id: string) => {
    dispatch({ type: 'SET_MATCHUP_ADV', pokeName: id === matchupAdvName ? null : id })
  }, [dispatch, matchupAdvName])

  const handleRemove = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_FROM_MATCHUP_CALC', pokeName: id })
  }, [dispatch])

  if (matchupCalcList.length === 0) {
    return (
      <>
        <div className="matchup-empty">
          <div style={{ fontSize: 12, opacity: 0.5 }}>Sélectionnez un adversaire puis cliquez "Add to Calc"</div>
        </div>
      </>
    )
  }

  return (
    <>
      <table className="damage-table matchup-damage-table">
      <thead>
        <tr>
          <th>PLAYER</th>
          <th className="speed-cell">SPEEDTIER</th>
          <th>OPPONENT</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(row => (
          <DamageRow
            key={row.id}
            row={row}
            useAdvStats
            isSelected={matchupAdvName === row.id}
            onSelect={() => handleSelect(row.id)}
            onRemove={() => handleRemove(row.id)}
          />
        ))}
      </tbody>
    </table>
    </>
  )
}
