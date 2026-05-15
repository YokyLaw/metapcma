'use client'

import { useAppState } from '../context/AppContext'
import { POKE_DATA } from '../data/pokeData'
import SearchSelect from './TeamPanel/SearchSelect'
import { useMemo, useState, useEffect, useRef } from 'react'
import { getUsage } from '../hooks/useUsageData'
import '../styles/teamBuilder.css'

import { MEGA_MAP } from '../data/megaMap'
import { POKEMON_TRANSLATIONS, TYPE_TRANSLATIONS, ABILITY_TRANSLATIONS, ITEM_TRANSLATIONS } from '../data/translations'
import { spriteUrl, getEffectivePokeName, artworkUrl, itemSpriteUrl } from '../calc/teamHelpers'
import { getStats, calcStat } from '../calc/statCalc'
import { NATURE_DATA, NATURE_STATS, NATURE_STAT_LABELS, STAT_KEYS, STAT_LABELS, STAT_BOOST_MULTS } from '../data/constants'
import { useFetchCCForSlot, extractName } from '../hooks/useCC'
import { getAbilityDesc } from '../hooks/useAbilityDesc'
import { getItemList, getItemDesc } from '../hooks/useItemDesc'
import { useSpeedTiers } from '../hooks/useSpeedTiers'

type ConfigTab = 'moves' | 'evs-def' | 'evs-off' | 'evs-spe'

const SPEED_BOOST_ABILITIES = new Set([
  'Swift Swim', 'Chlorophyll', 'Sand Rush', 'Slush Rush',
  'Quick Feet', 'Unburden', 'Surge Surfer',
])

function boostMult(stage: number): number {
  const key = stage === 0 ? '0' : (stage > 0 ? `+${stage}` : `${stage}`)
  return STAT_BOOST_MULTS[key] ?? 1
}

function fmtStage(stage: number): string {
  if (stage === 0) return '0'
  return stage > 0 ? `+${stage}` : `${stage}`
}

const NAT_PLUS_OPTIONS = NATURE_STATS.map(s => ({
  value: s, label: `+${NATURE_STAT_LABELS[s]}`,
}))

const NAT_MINUS_OPTIONS = NATURE_STATS.map(s => ({
  value: s, label: `-${NATURE_STAT_LABELS[s]}`,
}))

export default function NewTeamBuilder() {
  const { state, dispatch } = useAppState()
  const { team, selectedSlot } = state
  
  const activeSlotIdx = selectedSlot ?? 0
  const activeSlot = team[activeSlotIdx]
  const [activeTab, setActiveTab] = useState<ConfigTab>('moves')
  const fetchCC = useFetchCCForSlot()
  const { data: speedTiers, loading: loadingSpeedTiers } = useSpeedTiers()

  const translateAbility = (name: string) => ABILITY_TRANSLATIONS[name] || name
  const translateItem = (name: string) => ITEM_TRANSLATIONS[name] || name

  useEffect(() => {
    if (activeSlot.pokemon) fetchCC(activeSlotIdx, activeSlot.pokemon)
  }, [activeSlot.pokemon])

  const usedPokemonNames = useMemo(() => {
    return new Set(team.map((s, i) => i !== activeSlotIdx ? s.pokemon : '').filter(Boolean))
  }, [team, activeSlotIdx])

  const pokeOptions = useMemo(() => {
    return Object.keys(POKE_DATA)
      .filter(n => !n.startsWith('Mega ') && n !== 'Aegislash-Shield' && n !== 'Aegislash-Blade')
      .sort((a, b) => (getUsage(b) - getUsage(a)) || a.localeCompare(b))
      .map(n => ({
        value: n,
        label: n,
        image: spriteUrl(n),
        types: [POKE_DATA[n].t1, ...(POKE_DATA[n].t2 ? [POKE_DATA[n].t2] : [])],
        disabled: usedPokemonNames.has(n)
      }))
  }, [usedPokemonNames])

  const handleSelectSlot = (idx: number) => {
    dispatch({ type: 'SELECT_SLOT', slot: idx })
  }

  const handleUpdatePoke = (idx: number, name: string) => {
    dispatch({ type: 'UPDATE_SLOT_FIELD', slot: idx, field: 'pokemon', value: name })
  }

  const updateField = (field: string, value: string) => {
    dispatch({ type: 'UPDATE_SLOT_FIELD', slot: activeSlotIdx, field, value })
  }

  const effectiveName = getEffectivePokeName(activeSlot)
  const pokeData = effectiveName ? POKE_DATA[effectiveName] : null
  const frenchName = POKEMON_TRANSLATIONS[activeSlot.pokemon] || activeSlot.pokemon

  // Détection de la forme Méga via l'objet
  const megaFormeName = useMemo(() => {
    if (!activeSlot.pokemon || !activeSlot.item || activeSlot.item === '(No Item)') return null
    const megas = MEGA_MAP[activeSlot.pokemon]
    if (!megas) return null
    const foundEntry = Object.entries(megas).find(([, stone]) => stone === activeSlot.item)
    return foundEntry ? foundEntry[0] : null
  }, [activeSlot.pokemon, activeSlot.item])

  // CC Data for selects
  const abilityOptions = useMemo(() => {
    const baseAbilities = activeSlot.ccAllAbilities ?? (pokeData?.ab ? [pokeData.ab] : [])
    const ccAbilities = (activeSlot.ccAbilities as any[]) || []
    return [
      ...ccAbilities.map(e => ({
        value: extractName(e.ability.name),
        label: translateAbility(extractName(e.ability.name)),
        meta: e.percent > 0 ? `${Math.floor(e.percent)}%` : undefined,
        description: getAbilityDesc(extractName(e.ability.name))
      })),
      ...baseAbilities
        .filter(a => !ccAbilities.some(e => extractName(e.ability.name) === a))
        .map(a => ({ value: a, label: translateAbility(a), description: getAbilityDesc(a) }))
    ]
  }, [activeSlot.ccAbilities, activeSlot.ccAllAbilities, pokeData])

  const itemOptions = useMemo(() => {
    const baseItems = getItemList()
    const ccItems = (activeSlot.ccItems as any[]) || []
    const usedItems = new Set(team.map((s, i) => i !== activeSlotIdx ? s.item : '').filter(it => it && it !== '(No Item)'))
    
    // Filtrage des Méga-Gemmes
    const MEGA_STONES_ALL = new Set(Object.values(MEGA_MAP).flatMap(m => Object.values(m)))
    const allowedStones = new Set<string>()
    if (activeSlot.pokemon && MEGA_MAP[activeSlot.pokemon]) {
      Object.values(MEGA_MAP[activeSlot.pokemon]).forEach(stone => allowedStones.add(stone))
    }

    const filteredBaseItems = baseItems.filter(it => {
      if (MEGA_STONES_ALL.has(it)) return allowedStones.has(it)
      return true
    })

    return [
      { value: '(No Item)', label: '(Aucun)' },
      ...ccItems
        .filter(i => {
          const name = extractName(i.item.name)
          if (MEGA_STONES_ALL.has(name)) return allowedStones.has(name)
          return true
        })
        .map(i => ({
          value: extractName(i.item.name),
          label: translateItem(extractName(i.item.name)),
          meta: i.percent > 0 ? `${Math.floor(i.percent)}%` : undefined,
          image: itemSpriteUrl(extractName(i.item.name)),
          disabled: usedItems.has(extractName(i.item.name)),
          description: getItemDesc(extractName(i.item.name))
        })),
      ...filteredBaseItems
        .filter(it => !ccItems.some(i => extractName(i.item.name) === it))
        .map(it => ({
          value: it,
          label: translateItem(it),
          image: itemSpriteUrl(it),
          disabled: usedItems.has(it),
          description: getItemDesc(it)
        }))
    ]
  }, [activeSlot.ccItems, team, activeSlotIdx, activeSlot.pokemon])

  const [localNickname, setLocalNickname] = useState('')
  useEffect(() => {
    setLocalNickname(state.slotNotes[activeSlotIdx] || '')
  }, [activeSlotIdx, state.slotNotes])

  const handleNicknameChange = (val: string) => {
    setLocalNickname(val)
    dispatch({ type: 'UPDATE_SLOT_NOTES', slot: activeSlotIdx, notes: val })
  }

  const handleUpdateSP = (stat: string, value: number) => {
    dispatch({ type: 'UPDATE_SP', slot: activeSlotIdx, stat, value })
  }

  const [tierSearch, setTierSearch] = useState('')
  const speedSP = (activeSlot.sps as Record<string, number>).sp || 0
  const isDraggingSpeedRef = useRef(false)
  const lastUpdatedSPRef = useRef<number | null>(null)
  const segmentsContainerRef = useRef<HTMLDivElement>(null)
  const playerRowRef = useRef<HTMLDivElement>(null)
  const tiersListRef = useRef<HTMLDivElement>(null)

  const currentAbilityName = extractName(activeSlot.ability)
  const isSpeedAbility = SPEED_BOOST_ABILITIES.has(currentAbilityName)
  const abilityBoostActive = !!activeSlot.speedAbilityActive && isSpeedAbility

  const playerBoostStage = activeSlot.boosts?.sp ?? 0
  const playerBoostMult = boostMult(playerBoostStage)

  const playerSpeedMult = (state.tailwind ? 2 : 1)
    * (activeSlot.item === 'Choice Scarf' ? 1.5 : 1)
    * (abilityBoostActive ? 2 : 1)
    * playerBoostMult

  const currentSpeed = useMemo(() => {
    if (!pokeData) return 0
    const raw = getStats(pokeData, activeSlot.sps, activeSlot.natPlus, activeSlot.natMinus).sp
    return Math.floor(raw * playerSpeedMult)
  }, [pokeData, activeSlot.sps, activeSlot.natPlus, activeSlot.natMinus, playerSpeedMult])

  const speedStatsInfo = useMemo(() => {
    if (!pokeData) return { jumps: new Set<number>(), wastes: new Set<number>() }
    // Base stat at 50 with 31 IVs and 0 EVs
    const baseStatAt50 = Math.floor((pokeData.bs.sp * 2 + 31) * 0.5) + 5
    const plus = activeSlot.natPlus
    const minus = activeSlot.natMinus
    const natureBonus = (plus === 'sp') ? 1.1 : (minus === 'sp') ? 0.9 : 1
    
    const jumps = new Set<number>()
    const wastes = new Set<number>()
    
    if (natureBonus === 1) return { jumps, wastes }
    
    for (let sp = 1; sp <= 32; sp++) {
      const s1 = Math.floor((baseStatAt50 + sp) * natureBonus)
      const s0 = Math.floor((baseStatAt50 + sp - 1) * natureBonus)
      const diff = s1 - s0
      if (diff === 2) jumps.add(sp)
      if (diff === 0) wastes.add(sp)
    }
    return { jumps, wastes }
  }, [pokeData, activeSlot.natPlus, activeSlot.natMinus])

  const oppTwMult = state.advTailwind ? 2 : 1
  const advSpeedBoost = state.advSpeedBoost ?? 0
  const oppBoostMult = boostMult(advSpeedBoost)
  const oppSpeedMult = oppTwMult * oppBoostMult

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingSpeedRef.current || !segmentsContainerRef.current) return
      
      const rect = segmentsContainerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const width = rect.width
      
      // On divise la largeur par 32 segments pour correspondre aux cases visuelles.
      // Math.ceil permet de sélectionner le segment sur lequel on se trouve.
      let val = Math.ceil((x / width) * 32)
      val = Math.max(0, Math.min(32, val))
      
      if (lastUpdatedSPRef.current !== val) {
        handleUpdateSP('sp', val)
        lastUpdatedSPRef.current = val
      }
    }

    const handleGlobalMouseUp = () => {
      isDraggingSpeedRef.current = false
      lastUpdatedSPRef.current = null
    }

    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [activeSlotIdx]) // Re-bind if activeSlotIdx changes to ensure correct dispatch context

  useEffect(() => {
    const list = tiersListRef.current
    const player = playerRowRef.current
    if (!list || !player) return
    const listRect = list.getBoundingClientRect()
    const playerRect = player.getBoundingClientRect()
    const playerOffset = playerRect.top - listRect.top + list.scrollTop
    const targetTop = playerOffset - list.clientHeight / 2 + player.clientHeight / 2
    list.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
  }, [currentSpeed, tierSearch])

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (!segmentsContainerRef.current) return
    e.preventDefault()
    isDraggingSpeedRef.current = true
    
    const rect = segmentsContainerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const width = rect.width
    let val = Math.ceil((x / width) * 32)
    val = Math.max(0, Math.min(32, val))
    
    handleUpdateSP('sp', val)
    lastUpdatedSPRef.current = val
  }

  return (
    <div className="new-teambuilder-root">
      {/* ... top bar remains same ... */}
      {/* 6 Sélecteurs de Pokémon (Top Bar) */}
      <div className="top-selectors-grid">
        {team.map((slot, i) => {
          const isSelected = i === activeSlotIdx
          const hasPoke = !!slot.pokemon

          return (
            <div 
              key={i} 
              className={`top-slot-container ${isSelected ? 'active' : ''}`}
              onClick={() => handleSelectSlot(i)}
            >
              <div className="slot-search-row" onClick={e => e.stopPropagation()}>
                <div className="slot-search-action">
                  <SearchSelect
                    value={slot.pokemon}
                    options={pokeOptions}
                    onChange={(val) => handleUpdatePoke(i, val)}
                    placeholder=""
                    maxUnfiltered={50}
                  />
                </div>
                {hasPoke && (
                  <button
                    type="button"
                    className="slot-clear-btn"
                    onClick={() => handleUpdatePoke(i, '')}
                    aria-label="Retirer le Pokémon"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Interface centrale de configuration */}
      <div className="central-editor">
        {activeSlot.pokemon ? (
          <div className="editor-inner">
            {/* Cadre Visuel (Side) */}
            <div className="visual-side-panel">
              <div className="pokemon-visual-frame">
                <div className={`visual-image-container ${megaFormeName ? 'has-mega' : ''}`}>
                  <div className="visual-image-box base-artwork">
                    <img 
                      src={artworkUrl(activeSlot.pokemon)} 
                      alt={activeSlot.pokemon} 
                      className="visual-artwork"
                      onError={e => { e.currentTarget.src = spriteUrl(activeSlot.pokemon) }}
                    />
                    {MEGA_MAP[activeSlot.pokemon] && <div className="base-indicator">BASE</div>}
                  </div>
                  {megaFormeName && (
                    <div className="visual-image-box mega-artwork">
                      <img 
                        src={artworkUrl(megaFormeName)} 
                        alt={megaFormeName} 
                        className="visual-artwork"
                        onError={e => { e.currentTarget.src = spriteUrl(megaFormeName) }}
                      />
                      <div className="mega-indicator">MEGA</div>
                    </div>
                  )}
                </div>
                <div className="visual-info-box">
                  <h2 className="visual-name">
                    {frenchName}
                  </h2>
                  <div className="visual-types">
                    {pokeData && (
                      <>
                        <span className="type-badge" style={{ background: `var(--type-${pokeData.t1.toLowerCase()})` }}>
                          {TYPE_TRANSLATIONS[pokeData.t1] || pokeData.t1}
                        </span>
                        {pokeData.t2 && (
                          <span className="type-badge" style={{ background: `var(--type-${pokeData.t2.toLowerCase()})` }}>
                            {TYPE_TRANSLATIONS[pokeData.t2] || pokeData.t2}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {pokeData && (
                  <div className="visual-stats">
                    {(() => {
                      const computedStats = getStats(pokeData, activeSlot.sps, activeSlot.natPlus, activeSlot.natMinus)
                      return STAT_KEYS.map((key, i) => {
                        const baseVal = (pokeData.bs as Record<string, number>)[key] || 0
                        const finalVal = (computedStats as Record<string, number>)[key] || 0
                        const pct = Math.min(100, (finalVal / 250) * 100)
                        return (
                          <div key={key} className="visual-stat-row">
                            <span className="visual-stat-label">{STAT_LABELS[i]}</span>
                            <span className="visual-stat-base">{baseVal}</span>
                            <div className="visual-stat-bar-bg">
                              <div 
                                className="visual-stat-bar-fill" 
                                style={{ width: `${pct}%`, background: `var(--stat-${key})` }}
                              />
                            </div>
                            <span className="visual-stat-final">{finalVal}</span>
                          </div>
                        )
                      })
                    })()}
                    <div className="visual-stat-total">
                      Total: <span>{Object.values(pokeData.bs).reduce((a, b) => a + (b as number), 0)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Sélecteurs de base (Sous le visuel) */}
              <div className="visual-base-controls">
                <div className="form-group">
                  <label>Surnom</label>
                  <input 
                    type="text" 
                    className="nickname-input"
                    value={localNickname}
                    onChange={e => handleNicknameChange(e.target.value)}
                  />
                </div>
                
                <div className="form-group">
                  <label>Talent</label>
                  <SearchSelect
                    value={extractName(activeSlot.ability)}
                    options={abilityOptions}
                    onChange={v => updateField('ability', v)}
                    placeholder=""
                  />
                </div>

                <div className="form-group">
                  <label>Objet</label>
                  <SearchSelect
                    value={activeSlot.item}
                    options={itemOptions}
                    onChange={v => updateField('item', v)}
                    placeholder=""
                  />
                </div>

                <div className="form-group nature-group">
                  <label>Nature</label>
                  <div className="nature-inputs-container">
                    <SearchSelect
                      value={activeSlot.natPlus}
                      options={NAT_PLUS_OPTIONS}
                      onChange={v => updateField('natPlus', v)}
                      placeholder="+"
                      className="nature-select-plus"
                    />
                    <SearchSelect
                      value={activeSlot.natMinus}
                      options={NAT_MINUS_OPTIONS}
                      onChange={v => updateField('natMinus', v)}
                      placeholder="-"
                      className="nature-select-minus"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Zone de configuration (Main) */}
            <div className="config-main-panel">
              <div className="config-tabs-nav">
                <button 
                  className={`tab-link ${activeTab === 'moves' ? 'active' : ''}`}
                  onClick={() => setActiveTab('moves')}
                >
                  Capacités
                </button>
                <button 
                  className={`tab-link ${activeTab === 'evs-def' ? 'active' : ''}`}
                  onClick={() => setActiveTab('evs-def')}
                >
                  EVs Défensifs
                </button>
                <button 
                  className={`tab-link ${activeTab === 'evs-off' ? 'active' : ''}`}
                  onClick={() => setActiveTab('evs-off')}
                >
                  EVs Offensifs
                </button>
                <button 
                  className={`tab-link ${activeTab === 'evs-spe' ? 'active' : ''}`}
                  onClick={() => setActiveTab('evs-spe')}
                >
                  EVs Vitesse
                </button>
              </div>

              <div className="tab-body">
                {activeTab === 'moves' && (
                  <div className="pane-placeholder">Configuration des Capacités...</div>
                )}
                {activeTab === 'evs-def' && (
                  <div className="pane-placeholder">Configuration des EVs Défensifs...</div>
                )}
                {activeTab === 'evs-off' && (
                  <div className="pane-placeholder">Configuration des EVs Offensifs...</div>
                )}
                {activeTab === 'evs-spe' && (
                  <div className="speed-ev-config">
                    <div className="speed-ev-header">
                      {pokeData && (
                        (() => {
                          const computedStats = getStats(pokeData, activeSlot.sps, activeSlot.natPlus, activeSlot.natMinus)
                          const finalVal = computedStats.sp
                          const pct = Math.min(100, (finalVal / 250) * 100)
                          return (
                            <div className="visual-stat-row speed-header-stat">
                              <span className="visual-stat-label">{STAT_LABELS[5]}</span>
                              <span className="visual-stat-base">{(pokeData.bs as any).sp}</span>
                              <div className="visual-stat-bar-bg">
                                <div 
                                  className="visual-stat-bar-fill" 
                                  style={{ 
                                    width: `${pct}%`, 
                                    background: `var(--stat-sp)` 
                                  }}
                                />
                              </div>
                              <span className="visual-stat-final">
                                {finalVal}
                              </span>
                            </div>
                          )
                        })()
                      )}
                    </div>
                    
                    <div className="speed-ev-controls-row">
                      <div className="speed-ev-selector-bar">
                        <button 
                          className="speed-btn reset-btn" 
                          onClick={() => handleUpdateSP('sp', 0)}
                          title="Reset (0)"
                        >
                          0
                        </button>
                        
                        <button 
                          className="speed-btn dec-btn" 
                          onClick={() => handleUpdateSP('sp', Math.max(0, speedSP - 1))}
                          disabled={speedSP === 0}
                        >
                          -1
                        </button>

                        <div 
                          className="speed-segments-container"
                          ref={segmentsContainerRef}
                          onMouseDown={handleContainerMouseDown}
                        >
                          {Array.from({ length: 32 }).map((_, i) => {
                            const val = i + 1;
                            const isJump = speedStatsInfo.jumps.has(val);
                            const isWaste = speedStatsInfo.wastes.has(val);
                            return (
                              <div 
                                key={val} 
                                className={`speed-segment ${val <= speedSP ? 'active' : ''} ${isJump ? 'jump' : ''} ${isWaste ? 'waste' : ''}`}
                                title={isJump ? "Palier Nature (+2)" : isWaste ? "Perte Nature (+0)" : undefined}
                              />
                            );
                          })}
                        </div>

                        <button 
                          className="speed-btn inc-btn" 
                          onClick={() => handleUpdateSP('sp', Math.min(32, speedSP + 1))}
                          disabled={speedSP === 32}
                        >
                          +1
                        </button>

                        <button 
                          className="speed-btn max-btn" 
                          onClick={() => handleUpdateSP('sp', 32)}
                          title="Max (32)"
                        >
                          MAX
                        </button>
                      </div>

                      <div className="speed-ev-value">
                        {speedSP}
                      </div>
                    </div>

                    <div className="speed-tiers-container">
                      <div className="speed-tiers-toolbar">
                        <div className="speed-toolbar-group">
                          <span className="speed-toolbar-label">Champ</span>
                          <button
                            type="button"
                            className={`speed-toolbar-btn${state.trickRoom ? ' active' : ''}`}
                            onClick={() => dispatch({ type: 'SET_TRICK_ROOM', value: !state.trickRoom })}
                            title="Distorsion (inverse l'ordre de vitesse)"
                          >
                            Distorsion
                          </button>
                        </div>
                        <div className="speed-toolbar-group">
                          <span className="speed-toolbar-label">Joueur</span>
                          <button
                            type="button"
                            className={`speed-toolbar-btn${state.tailwind ? ' active' : ''}`}
                            onClick={() => dispatch({ type: 'SET_TAILWIND', value: !state.tailwind })}
                            title="Vent Arrière du joueur (×2 vitesse)"
                          >
                            Vent Arrière
                          </button>
                          {isSpeedAbility && (
                            <button
                              type="button"
                              className={`speed-toolbar-btn${abilityBoostActive ? ' active' : ''}`}
                              onClick={() => dispatch({ type: 'TOGGLE_SLOT_SPEED_ABILITY', slot: activeSlotIdx })}
                              title={`${translateAbility(currentAbilityName)} (×2 vitesse)`}
                            >
                              {translateAbility(currentAbilityName)}
                            </button>
                          )}
                          <div className="speed-stage-stepper" title="Modificateur de stat (-6 à +6)">
                            <button
                              type="button"
                              className="speed-stage-btn"
                              onClick={() => dispatch({ type: 'UPDATE_BOOST', slot: activeSlotIdx, stat: 'sp', value: Math.max(-6, playerBoostStage - 1) })}
                              disabled={playerBoostStage <= -6}
                            >−</button>
                            <span className={`speed-stage-val${playerBoostStage > 0 ? ' pos' : playerBoostStage < 0 ? ' neg' : ''}`}>
                              {fmtStage(playerBoostStage)}
                            </span>
                            <button
                              type="button"
                              className="speed-stage-btn"
                              onClick={() => dispatch({ type: 'UPDATE_BOOST', slot: activeSlotIdx, stat: 'sp', value: Math.min(6, playerBoostStage + 1) })}
                              disabled={playerBoostStage >= 6}
                            >+</button>
                          </div>
                        </div>
                        <div className="speed-toolbar-group">
                          <span className="speed-toolbar-label">Adversaire</span>
                          <button
                            type="button"
                            className={`speed-toolbar-btn${state.advTailwind ? ' active' : ''}`}
                            onClick={() => dispatch({ type: 'SET_ADV_TAILWIND', value: !state.advTailwind })}
                            title="Vent Arrière adverse (×2 vitesse des tiers)"
                          >
                            Vent Arrière
                          </button>
                          <div className="speed-stage-stepper" title="Modificateur de stat adversaire (-6 à +6)">
                            <button
                              type="button"
                              className="speed-stage-btn"
                              onClick={() => dispatch({ type: 'SET_ADV_SPEED_BOOST', value: advSpeedBoost - 1 })}
                              disabled={advSpeedBoost <= -6}
                            >−</button>
                            <span className={`speed-stage-val${advSpeedBoost > 0 ? ' pos' : advSpeedBoost < 0 ? ' neg' : ''}`}>
                              {fmtStage(advSpeedBoost)}
                            </span>
                            <button
                              type="button"
                              className="speed-stage-btn"
                              onClick={() => dispatch({ type: 'SET_ADV_SPEED_BOOST', value: advSpeedBoost + 1 })}
                              disabled={advSpeedBoost >= 6}
                            >+</button>
                          </div>
                        </div>
                      </div>
                      <div className="speed-tiers-header">
                        <div className="tier-col-speed">Vitesse</div>
                        <div className="tier-col-name">Pokémon</div>
                        <div className="tier-col-details">
                          <input
                            className="tier-search-input"
                            type="text"
                            placeholder="Rechercher..."
                            value={tierSearch}
                            onChange={e => setTierSearch(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="speed-tiers-list" ref={tiersListRef}>
                        {loadingSpeedTiers ? (
                          <div className="tiers-loading">Chargement des speed tiers...</div>
                        ) : (() => {
                          const q = tierSearch.trim().toLowerCase()

                          const tr = state.trickRoom
                          const isOutspd = (eff: number) => tr ? currentSpeed < eff : currentSpeed > eff

                          if (q) {
                            const filtered = speedTiers
                              .filter(t =>
                                t.pokemon.nom.toLowerCase().includes(q) ||
                                t.pokemon.name.toLowerCase().includes(q)
                              )
                              .map((tier, i) => {
                                const effSpeed = Math.floor(tier.speed * oppSpeedMult)
                                return (
                                  <div key={i} className={`speed-tier-row${isOutspd(effSpeed) ? ' outspeeded' : ''}${currentSpeed === effSpeed ? ' tied' : ''}`}>
                                    <div className="tier-col-speed">{effSpeed}</div>
                                    <div className="tier-col-name">
                                      {tier.pokemon.nom}
                                      {tier.percent != null && <span className="tier-usage">{Math.floor(tier.percent)}%</span>}
                                    </div>
                                    <div className="tier-col-details">
                                      <span className="tier-comment">{tier.bonus}</span>
                                    </div>
                                  </div>
                                )
                              })
                            return tr ? filtered.reverse() : filtered
                          }

                          const natSign = activeSlot.natPlus === 'sp' ? '+' : activeSlot.natMinus === 'sp' ? '-' : ''
                          const buildSuffix = (): string => {
                            const parts: string[] = []
                            if (abilityBoostActive) parts.push(`avec ${translateAbility(currentAbilityName)}`)
                            if (state.tailwind) parts.push('Vent Arrière')
                            if (activeSlot.item === 'Choice Scarf') parts.push('Choix Echarpe')
                            if (playerBoostStage !== 0) parts.push(`${fmtStage(playerBoostStage)} Vit`)
                            return parts.length ? ' ' + parts.join(' + ') : ''
                          }
                          const suffix = buildSuffix()
                          const playerBonus = `${speedSP} EV${natSign}${suffix}`

                          const playerRow = (
                            <div key="player" ref={playerRowRef} className="speed-tier-row player">
                              <div className="tier-col-speed">{currentSpeed}</div>
                              <div className="tier-col-name">{frenchName}</div>
                              <div className="tier-col-details">
                                <span className="tier-comment">{playerBonus}</span>
                              </div>
                            </div>
                          )

                          const playerIdx = tr
                            ? speedTiers.findIndex(t => Math.floor(t.speed * oppSpeedMult) < currentSpeed)
                            : speedTiers.findIndex(t => Math.floor(t.speed * oppSpeedMult) <= currentSpeed)
                          const playerInsert = playerIdx === -1 ? speedTiers.length : playerIdx

                          const rows = speedTiers.map((tier, i) => {
                            const effSpeed = Math.floor(tier.speed * oppSpeedMult)
                            return (
                              <div
                                key={i}
                                className={`speed-tier-row${isOutspd(effSpeed) ? ' outspeeded' : ''}${currentSpeed === effSpeed ? ' tied' : ''}`}
                              >
                                <div className="tier-col-speed">{effSpeed}</div>
                                <div className="tier-col-name">
                                  {tier.pokemon.nom}
                                  {tier.percent != null && <span className="tier-usage">{Math.floor(tier.percent)}%</span>}
                                </div>
                                <div className="tier-col-details">
                                  <span className="tier-comment">{tier.bonus}</span>
                                </div>
                              </div>
                            )
                          })

                          rows.splice(playerInsert, 0, playerRow)
                          return tr ? rows.reverse() : rows
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-editor-state">
            <p>Veuillez sélectionner un Pokémon pour commencer la configuration.</p>
          </div>
        )}
      </div>
    </div>
  )
}
