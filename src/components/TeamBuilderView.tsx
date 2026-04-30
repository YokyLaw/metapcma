'use client'

import '../styles/teamPanel.css'
import '../styles/teamBuilder.css'
import PokemonCard from './TeamPanel/PokemonCard'

export default function TeamBuilderView() {
  return (
    <div className="teambuilder-view">
      <div className="teambuilder-grid">
        {([0, 1, 2, 3, 4, 5] as const).map(i => (
          <PokemonCard key={i} slotIndex={i} />
        ))}
      </div>
    </div>
  )
}
