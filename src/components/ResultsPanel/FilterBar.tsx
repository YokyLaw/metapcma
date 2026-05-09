import { useAppState } from '../../context/AppContext'
import type { SortKey } from '../../types'

type SortMode = 'usageDesc' | 'usageAsc' | 'matchupTopDown' | 'matchupDownTop'

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'usageDesc',      label: 'Usage Top Down' },
  { value: 'usageAsc',       label: 'Usage Down Top' },
  { value: 'matchupTopDown', label: 'Matchup Top Down' },
  { value: 'matchupDownTop', label: 'Matchup Down Top' },
]

function modeToSort(mode: SortMode): { key: SortKey; asc: boolean } {
  switch (mode) {
    case 'usageDesc':      return { key: 'usage',   asc: false }
    case 'usageAsc':       return { key: 'usage',   asc: true }
    case 'matchupTopDown': return { key: 'matchup', asc: true }
    case 'matchupDownTop': return { key: 'matchup', asc: false }
  }
}

function sortToMode(key: SortKey, asc: boolean): SortMode {
  if (key === 'matchup') return asc ? 'matchupTopDown' : 'matchupDownTop'
  if (key === 'usage')   return asc ? 'usageAsc' : 'usageDesc'
  return 'usageDesc'
}

export default function FilterBar() {
  const { state, dispatch } = useAppState()
  const currentMode = sortToMode(state.sortKey, state.sortAsc)

  return (
    <div className="filter-bar">
      <input
        type="text"
        className="filter-input"
        placeholder="Rechercher un Pokémon..."
        value={state.filterSearch}
        onChange={e => dispatch({ type: 'SET_FILTER_SEARCH', value: e.target.value })}
      />

      <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--muted)', fontFamily:"'IBM Plex Mono',monospace", cursor:'pointer', whiteSpace:'nowrap' }}>
        <input
          type="checkbox"
          checked={state.showLowUsage}
          onChange={e => dispatch({ type: 'SET_SHOW_LOW_USAGE', value: e.target.checked })}
          style={{ accentColor: 'var(--accent2)' }}
        />
        Afficher &lt;0.8%
      </label>

      <select
        style={{ width: 180, marginLeft: 'auto' }}
        value={currentMode}
        onChange={e => {
          const { key, asc } = modeToSort(e.target.value as SortMode)
          dispatch({ type: 'SET_SORT', key, asc })
        }}
      >
        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
