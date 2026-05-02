import { useAppState } from '../../context/AppContext'
import { getMegaOptions } from '../../calc/teamHelpers'

interface Props {
  slotIndex: number
  pokemon: string
  megaForme: string
}

export default function MegaBar({ slotIndex, pokemon, megaForme }: Props) {
  const { state, dispatch } = useAppState()
  const slot = state.team[slotIndex]
  const megaOptions = getMegaOptions(pokemon)
  const hasCCData = !!(slot.ccMoves || slot.ccItems || slot.ccAbilities)

  const isAegislash = pokemon === 'Aegislash'

  if (!megaOptions && !hasCCData && !isAegislash) return null

  function handleMegaClick(forme: string, stone: string, e: React.MouseEvent) {
    e.stopPropagation()
    dispatch({ type: 'SELECT_MEGA', slot: slotIndex, megaForme: forme, stone })
  }

  return (
    <div className="mega-bar">
      {isAegislash && (
        <>
          <span className="mega-label">Formes :</span>
          <button
            className={'mega-btn' + (!megaForme ? ' active' : '')}
            onClick={e => { e.stopPropagation(); dispatch({ type: 'SELECT_FORME', slot: slotIndex, forme: '' }) }}
          >Shield</button>
          <button
            className={'mega-btn' + (megaForme === 'Aegislash-Blade' ? ' active' : '')}
            onClick={e => { e.stopPropagation(); dispatch({ type: 'SELECT_FORME', slot: slotIndex, forme: 'Aegislash-Blade' }) }}
          >Blade</button>
        </>
      )}
      {megaOptions && (
        <>
          <span className="mega-label">Formes :</span>
          <button
            className={'mega-btn' + (!megaForme ? ' active' : '')}
            onClick={e => handleMegaClick('', '', e)}
          >
            Base
          </button>
          {Object.entries(megaOptions).map(([mf, stone]) => (
            <button
              key={mf}
              className={'mega-btn' + (megaForme === mf ? ' active' : '')}
              onClick={e => handleMegaClick(mf, stone, e)}
            >
              {mf}
            </button>
          ))}
        </>
      )}
      {hasCCData && (
        <button
          className="mega-btn"
          style={{ marginLeft: 'auto' }}
          onClick={e => { e.stopPropagation(); dispatch({ type: 'APPLY_DEFAULT_SET', slot: slotIndex }) }}
        >
          Most Common Set
        </button>
      )}
    </div>
  )
}
