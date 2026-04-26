import { useAppState } from '../context/AppContext'
import type { Weather, Terrain } from '../types'
import { WEATHER_OPTIONS, TERRAIN_OPTIONS } from '../data/constants'
import '../styles/fieldBar.css'

export default function FieldBar() {
  const { state, dispatch } = useAppState()

  function handleWeather(val: Weather) {
    dispatch({ type: 'SET_WEATHER', weather: val })
  }

  function handleTerrain(val: Terrain) {
    dispatch({ type: 'SET_TERRAIN', terrain: val })
  }

  return (
    <div className="field-bar">
      <span className="field-label">Météo</span>
      <div className="field-group">
        {WEATHER_OPTIONS.map(o => (
          <button
            key={o.val}
            className={'field-btn' + (state.weather === o.val ? ' active' : '')}
            onClick={() => handleWeather(o.val as Weather)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="field-divider" />

      <span className="field-label">Terrain</span>
      <div className="field-group">
        {TERRAIN_OPTIONS.map(o => (
          <button
            key={o.val}
            className={'field-btn' + (state.terrain === o.val ? ' active' : '')}
            onClick={() => handleTerrain(o.val as Terrain)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="adv-slider-wrap">
        <span className="field-label">SP Adversaires</span>
        <input type="range" min={0} max={32} defaultValue={0} />
      </div>
    </div>
  )
}
