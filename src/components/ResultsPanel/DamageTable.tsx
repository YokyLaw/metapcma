import { useAppState } from '../../context/AppContext'
import { useTableFilter } from '../../hooks/useTableFilter'
import type { TableRow, SortKey } from '../../types'
import FilterBar from './FilterBar'
import DamageRow from './DamageRow'

interface ExtendedRow extends TableRow {
  spHP?: number; spDf?: number; spSd?: number
  spSp?: number; spAt?: number; spSa?: number
  advNatPlus?: string; advNatMinus?: string; advAbility?: string
}

export default function DamageTable() {
  const { state, dispatch } = useAppState()
  const { tableData, sortKey, sortAsc, filterSearch, filterType, filterKO, showLowUsage, advStats } = state

  const enrichedData: ExtendedRow[] = tableData.map(row => {
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

  const filteredData = useTableFilter(enrichedData as TableRow[], { sortKey, sortAsc, filterSearch, filterType, filterKO, showLowUsage })

  function handleSort(key: SortKey) {
    const newAsc = sortKey === key ? !sortAsc : false
    dispatch({ type: 'SET_SORT', key, asc: newAsc })
  }

  function thClass(key: SortKey) {
    return sortKey === key ? 'sorted' : ''
  }

  if (tableData.length === 0) {
    return (
      <>
        <FilterBar />
        <div className="loading">Sélectionnez au moins une attaque pour calculer les dégâts.</div>
      </>
    )
  }

  return (
    <>
      <FilterBar />
      <table className="damage-table">
        <thead>
          <tr>
            <th className={thClass('name')} onClick={() => handleSort('name')}>OPPONENT</th>
            <th className={thClass('move')} onClick={() => handleSort('move' as SortKey)}>OFFENSE</th>
            <th>DEFENSE</th>
            <th>SPEEDTIER</th>
          </tr>
        </thead>
        <tbody>
          {(filteredData as ExtendedRow[]).map(row => (
            <DamageRow key={row.name} row={row} />
          ))}
        </tbody>
      </table>
    </>
  )
}
