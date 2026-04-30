import { useAppState } from '../../context/AppContext'
import { getMegaOptions } from '../../calc/teamHelpers'

interface Props {
  slotIndex: number
  pokemon: string
  megaForme: string
}

export default function MegaBar({ slotIndex, pokemon, megaForme }: Props) {
  const { dispatch } = useAppState()
  const megaOptions = getMegaOptions(pokemon)
  if (!megaOptions) return <div className="mega-bar" aria-hidden />

  function handleClick(forme: string, stone: string, e: React.MouseEvent) {
    e.stopPropagation()
    dispatch({ type: 'SELECT_MEGA', slot: slotIndex, megaForme: forme, stone })
  }

  return (
    <div className="mega-bar">
      <span className="mega-label">Formes</span>
      <button
        className={'mega-btn' + (!megaForme ? ' active' : '')}
        onClick={e => handleClick('', '', e)}
      >
        Base
      </button>
      {Object.entries(megaOptions).map(([mf, stone]) => (
        <button
          key={mf}
          className={'mega-btn' + (megaForme === mf ? ' active' : '')}
          onClick={e => handleClick(mf, stone, e)}
        >
          {mf}
        </button>
      ))}
    </div>
  )
}
