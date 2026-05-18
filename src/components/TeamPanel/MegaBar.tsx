import { useState } from 'react'
import { useAppState } from '../../context/AppContext'
import { getMegaOptions } from '../../calc/teamHelpers'
import { NATURE_STAT_LABELS } from '../../data/constants'
import '../../styles/autoModal.css'

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

  const [confirmNature, setConfirmNature] = useState<{
    newNatPlus: string;
    newNatMinus: string;
  } | null>(null);

  const isAegislash = pokemon === 'Aegislash'

  if (!megaOptions && !hasCCData && !isAegislash) return null

  function handleMegaClick(forme: string, stone: string, e: React.MouseEvent) {
    e.stopPropagation()
    dispatch({ type: 'SELECT_MEGA', slot: slotIndex, megaForme: forme, stone })
  }

  function handleApplyDefaultSet(e: React.MouseEvent) {
    e.stopPropagation()
    const nextNatPlus = slot.ccNature?.natPlus || ""
    const nextNatMinus = slot.ccNature?.natMinus || ""

    if (nextNatPlus !== slot.natPlus || nextNatMinus !== slot.natMinus) {
      setConfirmNature({
        newNatPlus: nextNatPlus,
        newNatMinus: nextNatMinus,
      })
      return
    }

    dispatch({ type: 'APPLY_DEFAULT_SET', slot: slotIndex })
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
          onClick={handleApplyDefaultSet}
        >
          Most Common Set
        </button>
      )}

      {confirmNature && (
        <div className="auto-modal-overlay" onClick={() => setConfirmNature(null)}>
          <div className="auto-modal" onClick={e => e.stopPropagation()}>
            <div className="auto-modal-header">
              <span className="auto-modal-icon">⚠</span>
              <h3>Modification de nature requise</h3>
            </div>
            <div className="auto-modal-body">
              <p className="auto-modal-text">
                L'application du set recommandé va modifier la nature :
              </p>
              <div className="auto-modal-natures">
                <div className="auto-modal-nat-block">
                  <span className="auto-modal-nat-tag current">Actuelle</span>
                  <div className="auto-modal-nat plus faded">
                    <span className="nat-sign">+</span>
                    <span className="nat-stat">{slot.natPlus ? NATURE_STAT_LABELS[slot.natPlus] : '—'}</span>
                  </div>
                  <div className="auto-modal-nat minus faded">
                    <span className="nat-sign">−</span>
                    <span className="nat-stat">{slot.natMinus ? NATURE_STAT_LABELS[slot.natMinus] : '—'}</span>
                  </div>
                </div>
                <span className="auto-modal-arrow">→</span>
                <div className="auto-modal-nat-block">
                  <span className="auto-modal-nat-tag new">Nouvelle</span>
                  <div className="auto-modal-nat plus">
                    <span className="nat-sign">+</span>
                    <span className="nat-stat">{confirmNature.newNatPlus ? NATURE_STAT_LABELS[confirmNature.newNatPlus] : '—'}</span>
                  </div>
                  <div className="auto-modal-nat minus">
                    <span className="nat-sign">−</span>
                    <span className="nat-stat">{confirmNature.newNatMinus ? NATURE_STAT_LABELS[confirmNature.newNatMinus] : '—'}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="auto-modal-actions">
              <button className="auto-modal-btn cancel" onClick={() => setConfirmNature(null)}>
                Annuler
              </button>
              <button className="auto-modal-btn confirm" onClick={() => {
                dispatch({ type: 'APPLY_DEFAULT_SET', slot: slotIndex })
                setConfirmNature(null)
              }}>
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
