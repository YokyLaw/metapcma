import { useAppState } from '../../context/AppContext'
import { useTableFilter } from '../../hooks/useTableFilter'
import type { TableRow, SortKey } from '../../types'
import DamageRow from './DamageRow'

interface ExtendedRow extends TableRow {
  spHP?: number; spDf?: number; spSd?: number
  spSp?: number; spAt?: number; spSa?: number
  advNatPlus?: string; advNatMinus?: string; advAbility?: string
}

export default function DamageTable() {
  const { state, dispatch } = useAppState()
  const { tableData, sortKey, sortAsc, filterSearch, filterType, filterKO, showLowUsage } = state

  const enrichedData: ExtendedRow[] = tableData.map(row => ({
    ...row,
    spHP: 0, spDf: 0, spSd: 0, spSp: 0, spAt: 0, spSa: 0,
    advNatPlus: '', advNatMinus: '', advAbility: '',
  }))

  const filteredData = useTableFilter(enrichedData as TableRow[], { sortKey, sortAsc, filterSearch, filterType, filterKO, showLowUsage })

  function handleSort(key: SortKey) {
    const newAsc = sortKey === key ? !sortAsc : false
    dispatch({ type: 'SET_SORT', key, asc: newAsc })
  }

  function thClass(key: SortKey) {
    return sortKey === key ? 'sorted' : 'sortable'
  }

  if (tableData.length === 0) {
    return <div className="loading">Sélectionnez au moins une attaque pour calculer les dégâts.</div>
  }

  return (
    <>
      <table className="damage-table">
        <thead>
          <tr>
            <th>OFFENSE</th>
            <th className="speed-cell">SPEEDTIER</th>
            <th>DEFENSE</th>
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
