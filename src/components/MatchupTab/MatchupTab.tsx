'use client'

import { useAppState } from '../../context/AppContext'
import { spriteUrl } from '../../calc/teamHelpers'
import PokemonCard from '../TeamPanel/PokemonCard'
import MatchupTable from './MatchupTable'
import AdvCard from './AdvCard'
import FieldBar from '../FieldBar'
import '../../styles/matchupTab.css'
import '../../styles/fieldBar.css'

export default function MatchupTab() {
  const { state, dispatch } = useAppState()
  const { team, selectedSlot } = state

  const activeSlot = selectedSlot ?? 0

  return (
    <div className="matchup-root">
      <div className="matchup-layout">

        {/* LEFT — slot selector + PokemonCard + field controls */}
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
            ? <PokemonCard slotIndex={activeSlot} showBoosts />
            : <div className="matchup-no-poke">Slot vide</div>
          }

          <div className="matchup-field">
            <div className="field-row">
              <span className="field-label">Modificateurs</span>
              <div className="field-group">
                <button
                  className={'field-btn' + (state.tailwind ? ' active' : '')}
                  onClick={() => dispatch({ type: 'SET_TAILWIND', value: !state.tailwind })}
                >
                  Tailwind
                </button>
                <button
                  className={'field-btn' + (state.helpingHand ? ' active' : '')}
                  onClick={() => dispatch({ type: 'SET_HELPING_HAND', value: !state.helpingHand })}
                >
                  Helping Hand
                </button>
                <button
                  className={'field-btn' + (state.auroraVeil ? ' active' : '')}
                  onClick={() => {
                    const next = !state.auroraVeil
                    dispatch({ type: 'SET_AURORA_VEIL', value: next })
                    if (next) {
                      dispatch({ type: 'SET_REFLECT', value: false })
                      dispatch({ type: 'SET_LIGHT_SCREEN', value: false })
                    }
                  }}
                >
                  Aurora Veil
                </button>
                <button
                  className={'field-btn' + (state.reflect ? ' active' : '')}
                  onClick={() => {
                    const next = !state.reflect
                    dispatch({ type: 'SET_REFLECT', value: next })
                    if (next) dispatch({ type: 'SET_AURORA_VEIL', value: false })
                  }}
                >
                  Reflect
                </button>
                <button
                  className={'field-btn' + (state.lightScreen ? ' active' : '')}
                  onClick={() => {
                    const next = !state.lightScreen
                    dispatch({ type: 'SET_LIGHT_SCREEN', value: next })
                    if (next) dispatch({ type: 'SET_AURORA_VEIL', value: false })
                  }}
                >
                  Light Screen
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE — matchup table */}
        <div className="matchup-middle">
          <div className="matchup-sticky-header">
            <FieldBar className="field-bar--inline" hideDivers />
          </div>
          <div className="matchup-scroll">
            <MatchupTable />
          </div>
        </div>

        {/* RIGHT — adversary detail card */}
        <div className="matchup-right">
          {state.matchupAdvName && (
            <button
              className="add-to-calc-btn"
              onClick={() => {
                const currentId = state.matchupAdvName!
                if (!state.matchupCalcList.includes(currentId)) {
                  dispatch({ type: 'ADD_TO_MATCHUP_CALC', pokeName: currentId })
                } else {
                  const base = currentId.replace(/#\d+$/, '')
                  let nextId = base
                  let count = 2
                  while (state.matchupCalcList.includes(nextId)) nextId = `${base}#${count++}`
                  dispatch({ type: 'SET_MATCHUP_ADV', pokeName: nextId })
                }
              }}
            >
              Add to Calc
            </button>
          )}
          <AdvCard />
          <div className="matchup-field">
            <div className="field-row">
              <span className="field-label">Modificateurs</span>
              <div className="field-group">
                <button
                  className={'field-btn' + (state.advTailwind ? ' active' : '')}
                  onClick={() => dispatch({ type: 'SET_ADV_TAILWIND', value: !state.advTailwind })}
                >
                  Tailwind
                </button>
                <button
                  className={'field-btn' + (state.advHelpingHand ? ' active' : '')}
                  onClick={() => dispatch({ type: 'SET_ADV_HELPING_HAND', value: !state.advHelpingHand })}
                >
                  Helping Hand
                </button>
                <button
                  className={'field-btn' + (state.advAuroraVeil ? ' active' : '')}
                  onClick={() => {
                    const next = !state.advAuroraVeil
                    dispatch({ type: 'SET_ADV_AURORA_VEIL', value: next })
                    if (next) {
                      dispatch({ type: 'SET_ADV_REFLECT', value: false })
                      dispatch({ type: 'SET_ADV_LIGHT_SCREEN', value: false })
                    }
                  }}
                >
                  Aurora Veil
                </button>
                <button
                  className={'field-btn' + (state.advReflect ? ' active' : '')}
                  onClick={() => {
                    const next = !state.advReflect
                    dispatch({ type: 'SET_ADV_REFLECT', value: next })
                    if (next) dispatch({ type: 'SET_ADV_AURORA_VEIL', value: false })
                  }}
                >
                  Reflect
                </button>
                <button
                  className={'field-btn' + (state.advLightScreen ? ' active' : '')}
                  onClick={() => {
                    const next = !state.advLightScreen
                    dispatch({ type: 'SET_ADV_LIGHT_SCREEN', value: next })
                    if (next) dispatch({ type: 'SET_ADV_AURORA_VEIL', value: false })
                  }}
                >
                  Light Screen
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
