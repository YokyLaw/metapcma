'use client'

import { useAppState } from '../context/AppContext'
import { spriteUrl, itemSpriteUrl } from '../calc/teamHelpers'
import { MEGA_MAP } from '../data/megaMap'

const MEGA_STONES = new Set(
  Object.values(MEGA_MAP).flatMap(formes => Object.values(formes))
)

export default function CalcSidebar() {
  const { state, dispatch } = useAppState()
  const { team, selectedSlot } = state
  const activeSlot = selectedSlot ?? 0

  return (
    <div className="calc-sidebar">
      {team.map((slot, i) => {
        const hasItem = slot.item && slot.item !== '(No Item)'
        return (
          <button
            key={i}
            className={'calc-slot-btn' + (i === activeSlot ? ' active' : '')}
            onClick={() => dispatch({ type: 'SELECT_SLOT', slot: i })}
          >
            {slot.pokemon ? (
              <div className="slot-sprite-wrap">
                <img
                  src={spriteUrl(slot.pokemon)}
                  alt={slot.pokemon}
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
                {hasItem && (
                  <img
                    className={'slot-stone-overlay' + (MEGA_STONES.has(slot.item) ? ' mega' : '')}
                    src={itemSpriteUrl(slot.item)}
                    alt=""
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />
                )}
              </div>
            ) : (
              <span className="slot-btn-num">{i + 1}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
