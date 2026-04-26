import '../../styles/teamPanel.css'
import PokemonCard from './PokemonCard'

export default function TeamPanel() {
  return (
    <div className="team-panel">
      <div className="team-title">Composition de l&apos;équipe</div>
      {Array.from({ length: 6 }, (_, i) => (
        <PokemonCard key={i} slotIndex={i} />
      ))}
    </div>
  )
}
