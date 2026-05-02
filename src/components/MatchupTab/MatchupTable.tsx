import { useAppState } from '../../context/AppContext'
import type { TableRow } from '../../types'
import DamageRow from '../ResultsPanel/DamageRow'

interface ExtendedRow extends TableRow {
  spHP?: number; spDf?: number; spSd?: number
  spSp?: number; spAt?: number; spSa?: number
  advNatPlus?: string; advNatMinus?: string; advAbility?: string
}

export default function MatchupTable() {
  const { state, dispatch } = useAppState()
  const { tableData, advStats, favorites, matchupAdvName } = state

  const enriched: ExtendedRow[] = tableData
    .filter(row => favorites.includes(row.name))
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

  if (favorites.length === 0) {
    return (
      <div className="matchup-empty">
        <div className="matchup-empty-icon">★</div>
        <div>Aucun favori</div>
        <div style={{ fontSize: 12, opacity: 0.5 }}>Ajoutez des Pokémon aux favoris dans l'onglet Calc</div>
      </div>
    )
  }

  if (enriched.length === 0) {
    return (
      <div className="matchup-empty">
        <div style={{ fontSize: 12, opacity: 0.5 }}>Sélectionnez un Pokémon avec des attaques dans l'onglet Calc</div>
      </div>
    )
  }

  return (
    <table className="damage-table matchup-damage-table">
      <thead>
        <tr>
          <th>OFFENSE</th>
          <th>OPPONENT</th>
          <th>DEFENSE</th>
          <th>SPEED</th>
        </tr>
      </thead>
      <tbody>
        {enriched.map(row => (
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
  )
}
