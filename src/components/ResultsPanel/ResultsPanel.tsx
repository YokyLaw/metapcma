import { useAppState } from '../../context/AppContext'
import { getEffectivePokeName } from '../../calc/teamHelpers'
import DamageTable from './DamageTable'
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
      <div className="results-header">
        <div className="results-title">{effectiveName}</div>
      </div>

      <DamageTable />
    </div>
  )
}
