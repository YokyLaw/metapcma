import { useCallback, useState } from 'react'
import { useAppState } from '../../context/AppContext'
import { useTableFilter } from '../../hooks/useTableFilter'
import type { TableRow } from '../../types'
import type { ThreatBucket } from '../../calc/threatCalc'
import DamageRow from './DamageRow'

interface ExtendedRow extends TableRow {
  spHP?: number; spDf?: number; spSd?: number
  spSp?: number; spAt?: number; spSa?: number
  advNatPlus?: string; advNatMinus?: string; advAbility?: string
}

export default function DamageTable() {
  const { state } = useAppState()
  const { tableData, sortKey, sortAsc, filterSearch, filterType, filterKO, showLowUsage } = state

  const [threatMap, setThreatMap] = useState<Record<string, ThreatBucket>>({})

  const handleThreatChange = useCallback((rowName: string, bucket: ThreatBucket) => {
    setThreatMap(prev => (prev[rowName] === bucket ? prev : { ...prev, [rowName]: bucket }))
  }, [])

  const enrichedData: ExtendedRow[] = tableData.map(row => ({
    ...row,
    spHP: 0, spDf: 0, spSd: 0, spSp: 0, spAt: 0, spSa: 0,
    advNatPlus: '', advNatMinus: '', advAbility: '',
  }))

  const filteredData = useTableFilter(enrichedData as TableRow[], { sortKey, sortAsc, filterSearch, filterType, filterKO, showLowUsage, threatMap })

  if (tableData.length === 0) {
    return <div className="loading">Sélectionnez au moins une attaque pour calculer les dégâts.</div>
  }

  return (
    <>
      <table className="damage-table">
        <thead>
          <tr>
            <th>PLAYER</th>
            <th className="speed-cell">SPEEDTIER</th>
            <th>OPPONENT</th>
          </tr>
        </thead>
        <tbody>
          {(filteredData as ExtendedRow[]).map(row => (
            <DamageRow key={row.name} row={row} onThreatChange={handleThreatChange} />
          ))}
        </tbody>
      </table>
    </>
  )
}
