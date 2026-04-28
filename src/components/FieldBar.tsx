'use client'

import { useAppState } from '../context/AppContext'
import type { Weather, Terrain } from '../types'
import { WEATHER_OPTIONS, TERRAIN_OPTIONS } from '../data/constants'
import '../styles/fieldBar.css'

export default function FieldBar() {
  const { state, dispatch } = useAppState()

  return (
    <div className="field-bar">
      <div className="field-row">
        <span className="field-label">Météo</span>
        <div className="field-group">
          {WEATHER_OPTIONS.map(o => (
            <button
              key={o.val}
              className={'field-btn' + (state.weather === o.val ? ' active' : '')}
              onClick={() => dispatch({ type: 'SET_WEATHER', weather: o.val as Weather })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field-row">
        <span className="field-label">Terrain</span>
        <div className="field-group">
          {TERRAIN_OPTIONS.map(o => (
            <button
              key={o.val}
              className={'field-btn' + (state.terrain === o.val ? ' active' : '')}
              onClick={() => dispatch({ type: 'SET_TERRAIN', terrain: o.val as Terrain })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field-row">
        <span className="field-label">Divers</span>
        <div className="field-group">
          <button
            className={'field-btn' + (state.tailwind ? ' active' : '')}
            onClick={() => dispatch({ type: 'SET_TAILWIND', value: !state.tailwind })}
          >
            Vent Arrière
          </button>
        </div>
      </div>
    </div>
  )
}
