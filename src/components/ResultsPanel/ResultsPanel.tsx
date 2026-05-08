import { useAppState } from '../../context/AppContext'
import { getEffectivePokeName } from '../../calc/teamHelpers'
import DamageTable from './DamageTable'
import FilterBar from './FilterBar'
import FieldBar from '../FieldBar'
import '../../styles/resultsPanel.css'

export default function ResultsPanel() {
  const { state } = useAppState()
  const { team, selectedSlot } = state

  const slot = selectedSlot !== null ? team[selectedSlot] : null
  const hasSelection = slot !== null && slot.pokemon !== ''

  if (!hasSelection) {
    return (
      <div className="results-panel">
        <div className="no-selection">
          <div className="no-selection-icon">⚔</div>
          <div className="no-selection-text">SÉLECTIONNER UN POKÉMON</div>
          <div style={{ fontSize:12, opacity:0.5 }}>Cliquez sur un slot pour voir ses calculs de dégâts</div>
        </div>
      </div>
    )
  }

  const effectiveName = getEffectivePokeName(slot!)

  return (
    <div className="results-panel">
      <div className="results-sticky-header">
        <FilterBar />
        <FieldBar className="field-bar--inline" hideDivers />
      </div>
      <div className="results-scroll">
        <div className="results-header">
          <div className="results-title">{effectiveName}</div>
        </div>
        <DamageTable />
      </div>
    </div>
  )
}
