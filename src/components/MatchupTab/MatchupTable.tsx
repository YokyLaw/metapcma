import { useAppState } from '../../context/AppContext'
import type { TableRow } from '../../types'
import DamageRow from '../ResultsPanel/DamageRow'
import FieldBar from '../FieldBar'

interface ExtendedRow extends TableRow {
  spHP?: number; spDf?: number; spSd?: number
  spSp?: number; spAt?: number; spSa?: number
  advNatPlus?: string; advNatMinus?: string; advAbility?: string
}

export default function MatchupTable() {
  const { state, dispatch } = useAppState()
  const { tableData, advStats, matchupAdvName } = state

  const enriched: ExtendedRow[] = tableData
    .map(row => {
      const adv = advStats[row.name] || {}
      return {
        ...row,
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

  const sorted = matchupAdvName
    ? [...enriched].sort((a, b) =>
        a.name === matchupAdvName ? -1 : b.name === matchupAdvName ? 1 : 0
      )
    : enriched

  const fieldBarSticky = (
    <div className="matchup-sticky-bar">
      <FieldBar className="field-bar--inline" hideDivers />
    </div>
  )

  if (enriched.length === 0) {
    return (
      <>
        {fieldBarSticky}
        <div className="matchup-empty">
          <div style={{ fontSize: 12, opacity: 0.5 }}>Sélectionnez un Pokémon avec des attaques dans l'onglet Calc</div>
        </div>
      </>
    )
  }

  return (
    <>
      {fieldBarSticky}
      <table className="damage-table matchup-damage-table">
      <thead>
        <tr>
          <th>OFFENSE</th>
          <th>SPEED</th>
          <th>DEFENSE</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(row => (
          <DamageRow
            key={row.name}
            row={row}
            simplified
            isSelected={matchupAdvName === row.name}
            onSelect={() => dispatch({ type: 'SET_MATCHUP_ADV', pokeName: row.name === matchupAdvName ? null : row.name })}
          />
        ))}
      </tbody>
    </table>
    </>
  )
}
