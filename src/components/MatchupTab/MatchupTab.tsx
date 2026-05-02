import { useAppState } from '../../context/AppContext'
import { spriteUrl } from '../../calc/teamHelpers'
import PokemonCard from '../TeamPanel/PokemonCard'
import MatchupTable from './MatchupTable'
import AdvCard from './AdvCard'
import FieldBar from '../FieldBar'
import '../../styles/matchupTab.css'

export default function MatchupTab() {
  const { state, dispatch } = useAppState()
  const { team, selectedSlot, slotNotes } = state

  const activeSlot = selectedSlot ?? 0

  return (
    <div className="matchup-root">
      <div className="matchup-layout">

        {/* LEFT — slot selector + PokemonCard + notes */}
        <div className="matchup-left">
          <div className="matchup-slot-bar">
            {team.map((slot, i) => (
              <button
                key={i}
                className={'matchup-slot-btn' + (activeSlot === i ? ' active' : '')}
                onClick={() => dispatch({ type: 'SELECT_SLOT', slot: i })}
                title={slot.pokemon || `Slot ${i + 1}`}
              >
                {slot.pokemon
                  ? <img src={spriteUrl(slot.pokemon)} alt={slot.pokemon} className="matchup-slot-sprite" onError={e => { e.currentTarget.style.display = 'none' }} />
                  : <span className="matchup-slot-num">{i + 1}</span>
                }
              </button>
            ))}
          </div>

          {team[activeSlot]?.pokemon
            ? <PokemonCard slotIndex={activeSlot} />
            : <div className="matchup-no-poke">Slot vide</div>
          }

          <textarea
            className="matchup-notes"
            placeholder="Notes sur ce Pokémon..."
            value={slotNotes[activeSlot] || ''}
            onChange={e => dispatch({ type: 'SET_SLOT_NOTES', slot: activeSlot, notes: e.target.value })}
          />
        </div>

        {/* MIDDLE — favorites table */}
        <div className="matchup-middle">
          <MatchupTable />
        </div>

        {/* RIGHT — adversary detail card */}
        <div className="matchup-right">
          <AdvCard />
        </div>
      </div>

      <FieldBar />
    </div>
  )
}
