import { useAppState } from '../../context/AppContext'
import { TYPE_NAMES } from '../../data/constants'

export default function FilterBar() {
  const { state, dispatch } = useAppState()

  function setSortMode(mode: 'usage' | 'damage') {
    dispatch({ type: 'SET_SORT', key: mode === 'damage' ? 'maxPct' : 'usage', asc: false })
  }

  const sortByUsage = state.sortKey === 'usage'
  const sortByDamage = state.sortKey === 'maxPct'

  return (
    <div className="filter-bar">
      <input
        type="text"
        className="filter-input"
        placeholder="Rechercher un Pokémon..."
        value={state.filterSearch}
        onChange={e => dispatch({ type: 'SET_FILTER_SEARCH', value: e.target.value })}
      />

      <select
        style={{ width: 130 }}
        value={state.filterType}
        onChange={e => dispatch({ type: 'SET_FILTER_TYPE', value: e.target.value })}
      >
        <option value="">Tous types</option>
        {TYPE_NAMES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      <select
        style={{ width: 120 }}
        value={state.filterKO}
        onChange={e => dispatch({ type: 'SET_FILTER_KO', value: e.target.value as '' | 'ohko' | 'ko' })}
      >
        <option value="">Tous résultats</option>
        <option value="ohko">OHKO seulement</option>
        <option value="ko">KO potentiel</option>
      </select>

      <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--muted)', fontFamily:"'IBM Plex Mono',monospace", cursor:'pointer', whiteSpace:'nowrap' }}>
        <input
          type="checkbox"
          checked={state.showLowUsage}
          onChange={e => dispatch({ type: 'SET_SHOW_LOW_USAGE', value: e.target.checked })}
          style={{ accentColor: 'var(--accent2)' }}
        />
        Afficher &lt;0.8%
      </label>

      <div style={{ display:'flex', gap:4, marginLeft:'auto' }}>
        <button
          className={'field-btn' + (sortByUsage ? ' active' : '')}
          onClick={() => setSortMode('usage')}
        >
          PAR USAGE
        </button>
        <button
          className={'field-btn' + (sortByDamage ? ' active' : '')}
          onClick={() => setSortMode('damage')}
        >
          PAR DÉGÂTS
        </button>
      </div>
    </div>
  )
}
