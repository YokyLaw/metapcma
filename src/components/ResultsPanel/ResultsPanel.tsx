import { useAppState } from '../../context/AppContext'
import { POKE_DATA } from '../../data/pokeData'
import { MOVE_DATA } from '../../data/moveData'
import { NATURE_STAT_LABELS } from '../../data/constants'
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
  const atkPokeData = POKE_DATA[effectiveName]

  const natText = (slot!.natPlus || slot!.natMinus)
    ? `+${NATURE_STAT_LABELS[slot!.natPlus] || '—'} / -${NATURE_STAT_LABELS[slot!.natMinus] || '—'}`
    : 'Neutre'
  const validMoves = slot!.moves.filter(m => m && MOVE_DATA[m])
  const subtitle = `${slot!.ability || (atkPokeData?.ab as string) || ''} · ${slot!.item || 'Sans objet'} · ${natText} · ${validMoves.length > 0 ? validMoves.join(' / ') : '⚠ Aucune attaque sélectionnée'}`

  return (
    <div className="results-panel">
      <div className="results-header">
        <div>
          <div className="results-title">{effectiveName}</div>
          <div style={{ fontSize:12, color:'var(--muted)', fontFamily:"'IBM Plex Mono',monospace", marginTop:2 }}>
            {subtitle}
          </div>
        </div>
      </div>

      <DamageTable />
    </div>
  )
}
