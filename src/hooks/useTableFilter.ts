import { useMemo } from 'react'
import type { TableRow, SortKey } from '../types'
import { USAGE_MAP, USAGE_THRESHOLD } from '../data/usageData'

interface FilterState {
  sortKey: SortKey
  sortAsc: boolean
  filterSearch: string
  filterType: string
  filterKO: '' | 'ohko' | 'ko'
  showLowUsage: boolean
}

export function useTableFilter(tableData: TableRow[], filters: FilterState): TableRow[] {
  return useMemo(() => {
    const { sortKey, sortAsc, filterSearch, filterType, filterKO, showLowUsage } = filters

    const filtered = tableData.filter(r => {
      if (!showLowUsage) {
        const usage = USAGE_MAP[r.name]
        if (usage === undefined || usage <= USAGE_THRESHOLD) return false
      }
      if (filterSearch && !r.name.toLowerCase().includes(filterSearch.toLowerCase())) return false
      if (filterType && r.type1 !== filterType && r.type2 !== filterType) return false
      if (filterKO === 'ohko' && !r.isOHKO) return false
      if (filterKO === 'ko' && !r.isKO && !r.isOHKO) return false
      return true
    })

    return [...filtered].sort((a, b) => {
      if (sortKey === 'usage') {
        const ua = USAGE_MAP[a.name] ?? -1
        const ub = USAGE_MAP[b.name] ?? -1
        return ub - ua
      }
      const av = (a as unknown as Record<string, unknown>)[sortKey]
      const bv = (b as unknown as Record<string, unknown>)[sortKey]
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortAsc ? av - bv : bv - av
      }
      return 0
    })
  }, [tableData, filters.sortKey, filters.sortAsc, filters.filterSearch, filters.filterType, filters.filterKO, filters.showLowUsage])
}
