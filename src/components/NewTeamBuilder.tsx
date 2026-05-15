'use client'

import { useAppState } from '../context/AppContext'
import { POKE_DATA } from '../data/pokeData'
import SearchSelect from './TeamPanel/SearchSelect'
import { useMemo, useState, useEffect, useRef } from 'react'
import { getUsage, useUsageLoaded } from '../hooks/useUsageData'
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
import { useDescTooltip } from '../hooks/useDescTooltip'
import type { StatKey } from '../types'

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

function formatTierBonus(bonus: string): string {
  return bonus
    .replace(/(\d+ EV[+-]?) (?!avec )(\S)/, '$1 | $2')
    .replace(' avec ', ' | ')
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
  const [viewingMegaForm, setViewingMegaForm] = useState(false)
  const fetchCC = useFetchCCForSlot()
  const { data: speedTiers, loading: loadingSpeedTiers } = useSpeedTiers()
  const { tooltip: filterTooltip, tooltipRef: filterTooltipRef, handleEnter: handleFilterEnter, handleLeave: handleFilterLeave } = useDescTooltip()
  const usageLoaded = useUsageLoaded()

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
      .map(n => {
        const u = getUsage(n)
        return {
          value: n,
          label: n,
          meta: u > 0 ? `${Math.floor(u * 10) / 10}%` : undefined,
          image: spriteUrl(n),
          types: [POKE_DATA[n].t1, ...(POKE_DATA[n].t2 ? [POKE_DATA[n].t2] : [])],
          disabled: usedPokemonNames.has(n)
        }
      })
  }, [usedPokemonNames, usageLoaded])

  const handleSelectSlot = (idx: number) => {
    dispatch({ type: 'SELECT_SLOT', slot: idx })
  }

  const handleUpdatePoke = (idx: number, name: string) => {
    dispatch({ type: 'UPDATE_SLOT_FIELD', slot: idx, field: 'pokemon', value: name })
  }

  const updateField = (field: string, value: string) => {
    dispatch({ type: 'UPDATE_SLOT_FIELD', slot: activeSlotIdx, field, value })
  }

  const handleItemChange = (v: string) => {
    const megas = activeSlot.pokemon ? MEGA_MAP[activeSlot.pokemon] : null
    if (megas) {
      const megaEntry = Object.entries(megas).find(([, stone]) => stone === v)
      if (megaEntry) {
        dispatch({ type: 'SELECT_MEGA', slot: activeSlotIdx, megaForme: megaEntry[0], stone: v })
        return
      }
      if (activeSlot.megaForme) {
        dispatch({ type: 'SELECT_MEGA', slot: activeSlotIdx, megaForme: '', stone: '' })
        dispatch({ type: 'UPDATE_SLOT_FIELD', slot: activeSlotIdx, field: 'item', value: v })
        return
      }
    }
    updateField('item', v)
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

  useEffect(() => {
    if (!megaFormeName) setViewingMegaForm(false)
  }, [megaFormeName])

  // Sync megaForme slot field with item-derived megaFormeName (handles pre-existing localStorage state)
  useEffect(() => {
    if (!activeSlot.pokemon) return
    if (megaFormeName && megaFormeName !== activeSlot.megaForme) {
      dispatch({ type: 'SELECT_MEGA', slot: activeSlotIdx, megaForme: megaFormeName, stone: activeSlot.item })
    } else if (!megaFormeName && activeSlot.megaForme) {
      dispatch({ type: 'SELECT_MEGA', slot: activeSlotIdx, megaForme: '', stone: '' })
    }
  }, [megaFormeName, activeSlotIdx])

  const displayPokeData = viewingMegaForm && megaFormeName
    ? (POKE_DATA[megaFormeName] ?? null)
    : (activeSlot.pokemon ? POKE_DATA[activeSlot.pokemon] : null)

  const isViewingMega = !!(viewingMegaForm && megaFormeName)
  const displayedAbility = isViewingMega
    ? extractName(activeSlot.ability)
    : (megaFormeName ? (activeSlot.preMegaAbility || '') : extractName(activeSlot.ability))

  // CC Data for selects
  const abilityOptions = useMemo(() => {
    if (isViewingMega) {
      return displayPokeData?.ab
        ? [{ value: displayPokeData.ab, label: translateAbility(displayPokeData.ab), description: getAbilityDesc(displayPokeData.ab) }]
        : []
    }
    const basePokeData = activeSlot.pokemon ? POKE_DATA[activeSlot.pokemon] : null
    const baseAbilities = activeSlot.ccAllAbilities ?? (basePokeData?.ab ? [basePokeData.ab] : [])
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
  }, [activeSlot.ccAbilities, activeSlot.ccAllAbilities, activeSlot.pokemon, displayPokeData, isViewingMega])

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
    dispatch({ type: 'SET_SLOT_NOTES', slot: activeSlotIdx, notes: val })
  }

  const handleUpdateSP = (stat: StatKey, value: number) => {
    dispatch({ type: 'UPDATE_SP', slot: activeSlotIdx, stat, value })
  }

  const [filterTabs, setFilterTabs] = useState<Record<string, 'custom' | 'threats'>>({ def: 'custom', off: 'custom', speed: 'custom' })
  const [tierSearch, setTierSearch] = useState('')
  const [confirmNatSwap, setConfirmNatSwap] = useState<{
    conflictStat: string
    fallbackEv: number | null
    fallbackReaches: number | null
    neutralNatPlus: string
    neutralNatMinus: string
    tr: boolean
  } | null>(null)
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
    if (!displayPokeData) return 0
    const raw = getStats(displayPokeData, activeSlot.sps, activeSlot.natPlus, activeSlot.natMinus).sp
    return Math.floor(raw * playerSpeedMult)
  }, [displayPokeData, activeSlot.sps, activeSlot.natPlus, activeSlot.natMinus, playerSpeedMult])

  const speedStatsInfo = useMemo(() => {
    if (!displayPokeData) return { jumps: new Set<number>(), wastes: new Set<number>() }
    // Base stat at 50 with 31 IVs and 0 EVs
    const baseStatAt50 = Math.floor((displayPokeData.bs.sp * 2 + 31) * 0.5) + 5
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
  }, [displayPokeData, activeSlot.natPlus, activeSlot.natMinus])

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

  const computeAutoTrial = (np: string, nm: string) => {
    if (!displayPokeData) return null
    const filters = activeSlot.speedFilters || []
    if (filters.length === 0) return null
    const tr = state.trickRoom
    const uniqueTargets = Array.from(new Set(filters.map(f => f.speed)))
    const sorted = tr
      ? [...uniqueTargets].sort((a, b) => a - b)
      : [...uniqueTargets].sort((a, b) => b - a)
    for (const t of sorted) {
      for (let ev = 0; ev <= 32; ev++) {
        const sps = { ...activeSlot.sps, sp: ev }
        const raw = getStats(displayPokeData, sps, np, nm).sp
        const s = Math.floor(raw * playerSpeedMult)
        const ok = tr ? s < t : s > t
        if (ok) return { ev, reaches: t, topTarget: sorted[0] }
      }
    }
    return null
  }

  const applyAutoSwap = (tr: boolean) => {
    let newNatPlus = activeSlot.natPlus
    let newNatMinus = activeSlot.natMinus
    if (tr) {
      newNatMinus = 'sp'
      if (newNatPlus === 'sp') newNatPlus = ''
    } else {
      newNatPlus = 'sp'
      if (newNatMinus === 'sp') newNatMinus = ''
    }
    const result = computeAutoTrial(newNatPlus, newNatMinus)
    if (!result) {
      handleUpdateSP('sp', 0)
      return
    }
    if (newNatPlus !== activeSlot.natPlus) {
      dispatch({ type: 'UPDATE_SLOT_FIELD', slot: activeSlotIdx, field: 'natPlus', value: newNatPlus })
    }
    if (newNatMinus !== activeSlot.natMinus) {
      dispatch({ type: 'UPDATE_SLOT_FIELD', slot: activeSlotIdx, field: 'natMinus', value: newNatMinus })
    }
    handleUpdateSP('sp', result.ev)
  }

  const handleAutoSpeed = () => {
    if (!pokeData) return
    const filters = activeSlot.speedFilters || []
    if (filters.length === 0) return

    const tr = state.trickRoom

    // Step 1: current natures
    const currentResult = computeAutoTrial(activeSlot.natPlus, activeSlot.natMinus)
    if (currentResult && currentResult.reaches === currentResult.topTarget) {
      handleUpdateSP('sp', currentResult.ev)
      return
    }

    // Step 2: neutral speed — remove the nature that penalizes in current direction
    // Normal: remove natMinus='sp' if present | TR: remove natPlus='sp' if present
    const neutralNatPlus = tr && activeSlot.natPlus === 'sp' ? '' : activeSlot.natPlus
    const neutralNatMinus = !tr && activeSlot.natMinus === 'sp' ? '' : activeSlot.natMinus
    const isNeutralDifferent = neutralNatPlus !== activeSlot.natPlus || neutralNatMinus !== activeSlot.natMinus
    if (isNeutralDifferent) {
      const neutralResult = computeAutoTrial(neutralNatPlus, neutralNatMinus)
      if (neutralResult && neutralResult.reaches === neutralResult.topTarget) {
        if (neutralNatPlus !== activeSlot.natPlus)
          dispatch({ type: 'UPDATE_SLOT_FIELD', slot: activeSlotIdx, field: 'natPlus', value: neutralNatPlus })
        if (neutralNatMinus !== activeSlot.natMinus)
          dispatch({ type: 'UPDATE_SLOT_FIELD', slot: activeSlotIdx, field: 'natMinus', value: neutralNatMinus })
        handleUpdateSP('sp', neutralResult.ev)
        return
      }
    }

    // Step 3: full +sp / -sp nature change
    const conflictField = tr ? activeSlot.natMinus : activeSlot.natPlus
    if (conflictField && conflictField !== 'sp') {
      // On cancel: best reachable with neutral speed natures (no +sp penalty removed)
      const cancelNatPlus = tr && activeSlot.natPlus === 'sp' ? '' : activeSlot.natPlus
      const cancelNatMinus = !tr && activeSlot.natMinus === 'sp' ? '' : activeSlot.natMinus
      const isNeutralDiff = cancelNatPlus !== activeSlot.natPlus || cancelNatMinus !== activeSlot.natMinus
      const cancelResult = isNeutralDiff
        ? computeAutoTrial(cancelNatPlus, cancelNatMinus)
        : currentResult
      setConfirmNatSwap({
        conflictStat: conflictField,
        fallbackEv: cancelResult?.ev ?? null,
        fallbackReaches: cancelResult?.reaches ?? null,
        neutralNatPlus: cancelNatPlus,
        neutralNatMinus: cancelNatMinus,
        tr,
      })
      return
    }

    applyAutoSwap(tr)
  }

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
      {/* 6 Sélecteurs de Pokémon (Sidebar gauche) */}
      <div className="top-selectors-grid">
        {team.map((slot, i) => {
          const isSelected = i === activeSlotIdx
          const hasPoke = !!slot.pokemon
          const hasItem = hasPoke && !!slot.item && slot.item !== '(No Item)'

          return (
            <div
              key={i}
              className={`top-slot-container ${isSelected ? 'active' : ''} ${hasPoke ? 'has-poke' : 'no-poke'}`}
              onClickCapture={() => handleSelectSlot(i)}
            >
              <div className="slot-main">
                {!hasPoke && <span className="slot-empty-num">{i + 1}</span>}
                <SearchSelect
                  value={slot.pokemon}
                  options={pokeOptions}
                  onChange={(val) => handleUpdatePoke(i, val)}
                  placeholder="+ Pokémon"
                  maxUnfiltered={150}
                />
                {hasPoke && (
                  <button
                    type="button"
                    className="slot-clear-btn"
                    onClick={(e) => { e.stopPropagation(); handleUpdatePoke(i, '') }}
                    aria-label="Retirer le Pokémon"
                  >
                    ✕
                  </button>
                )}
              </div>
              {hasItem && (
                <div className="slot-item-line">
                  <img
                    className="slot-item-icon"
                    src={itemSpriteUrl(slot.item)}
                    alt=""
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />
                  <span className="slot-item-name">{ITEM_TRANSLATIONS[slot.item] || slot.item}</span>
                </div>
              )}
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
                  <div
                    className={`visual-image-box base-artwork${megaFormeName ? ` form-clickable${!viewingMegaForm ? ' form-selected' : ''}` : ''}`}
                    onClick={() => { if (megaFormeName) setViewingMegaForm(false) }}
                  >
                    <img
                      src={artworkUrl(activeSlot.pokemon)}
                      alt={activeSlot.pokemon}
                      className="visual-artwork"
                      onError={e => { e.currentTarget.src = spriteUrl(activeSlot.pokemon) }}
                    />
                    {MEGA_MAP[activeSlot.pokemon] && <div className="base-indicator">BASE</div>}
                  </div>
                  {megaFormeName && (
                    <div
                      className={`visual-image-box mega-artwork form-clickable${viewingMegaForm ? ' form-selected' : ''}`}
                      onClick={() => setViewingMegaForm(true)}
                    >
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
                    {displayPokeData && (
                      <>
                        <span className="type-badge" style={{ background: `var(--type-${displayPokeData.t1.toLowerCase()})` }}>
                          {TYPE_TRANSLATIONS[displayPokeData.t1] || displayPokeData.t1}
                        </span>
                        {displayPokeData.t2 && (
                          <span className="type-badge" style={{ background: `var(--type-${displayPokeData.t2.toLowerCase()})` }}>
                            {TYPE_TRANSLATIONS[displayPokeData.t2] || displayPokeData.t2}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {displayPokeData && (
                  <div className="visual-stats">
                    {(() => {
                      const computedStats = getStats(displayPokeData, activeSlot.sps, activeSlot.natPlus, activeSlot.natMinus)
                      return STAT_KEYS.map((key, i) => {
                        const baseVal = (displayPokeData.bs as Record<string, number>)[key] || 0
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
                      Total: <span>{Object.values(displayPokeData.bs).reduce((a, b) => a + (b as number), 0)}</span>
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
                    value={displayedAbility}
                    options={abilityOptions}
                    onChange={v => {
                      if (isViewingMega) return
                      if (megaFormeName) {
                        dispatch({ type: 'UPDATE_SLOT_FIELD', slot: activeSlotIdx, field: 'preMegaAbility', value: v })
                      } else {
                        updateField('ability', v)
                      }
                    }}
                    placeholder=""
                    disabled={isViewingMega && activeSlot.pokemon !== 'Aegislash'}
                  />
                </div>

                <div className="form-group">
                  <label>Objet</label>
                  <SearchSelect
                    value={activeSlot.item}
                    options={itemOptions}
                    onChange={handleItemChange}
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
                    <div className="speed-ev-controls-row">
                      <div className="speed-ev-selector-bar">
                        <button 
                          className="speed-btn reset-btn" 
                          onClick={() => handleUpdateSP('sp', 0)}
                          title="Reset (0)"
                        >
                          0
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
                      <div className="speed-tiers-search">
                        <input
                          className="tier-search-input"
                          type="text"
                          placeholder="Rechercher un Pokémon..."
                          value={tierSearch}
                          onChange={e => setTierSearch(e.target.value)}
                        />
                      </div>
                      <div className="speed-tiers-header">
                        <div className="tier-col-speed">Vitesse</div>
                        <div className="tier-col-name">Pokémon</div>
                        <div className="tier-col-details">Détails</div>
                        <div className="tier-col-action">Filtre</div>
                      </div>
                      <div className="speed-tiers-list" ref={tiersListRef}>
                        {loadingSpeedTiers ? (
                          <div className="tiers-loading">Chargement des speed tiers...</div>
                        ) : (() => {
                          const q = tierSearch.trim().toLowerCase()

                          const tr = state.trickRoom
                          const isOutspd = (eff: number) => tr ? currentSpeed < eff : currentSpeed > eff

                          const oppParts: string[] = []
                          if (state.advTailwind) oppParts.push('Vent Arrière')
                          if (advSpeedBoost !== 0) oppParts.push(`${fmtStage(advSpeedBoost)} Vit`)
                          const oppSuffix = oppParts.length ? ' | ' + oppParts.join(' | ') : ''

                          if (q) {
                            const filtered = speedTiers
                              .filter(t =>
                                t.pokemon.nom.toLowerCase().includes(q) ||
                                t.pokemon.name.toLowerCase().includes(q)
                              )
                              .map((tier, i) => {
                                const effSpeed = Math.floor(tier.speed * oppSpeedMult)
                                const alreadyAdded = activeSlot.speedFilters?.some(f => f.pokemonName === tier.pokemon.nom && f.speed === effSpeed) ?? false
                                return (
                                  <div key={i} className={`speed-tier-row${isOutspd(effSpeed) ? ' outspeeded' : ''}${currentSpeed === effSpeed ? ' tied' : ''}`}>
                                    <div className="tier-col-speed">{effSpeed}</div>
                                    <div className="tier-col-name">
                                      {tier.pokemon.nom}
                                      {tier.percent != null && <span className="tier-usage">{Math.floor(tier.percent)}%</span>}
                                    </div>
                                    <div className="tier-col-details">
                                      <span className="tier-comment">{formatTierBonus(tier.bonus) + oppSuffix}</span>
                                    </div>
                                    <div className="tier-col-action">
                                      <button
                                        type="button"
                                        className={`tier-add-btn${alreadyAdded ? ' added' : ''}`}
                                        disabled={alreadyAdded}
                                        onClick={() => dispatch({
                                          type: 'ADD_SPEED_FILTER',
                                          slot: activeSlotIdx,
                                          filter: {
                                            id: `${tier.pokemon.name}-${effSpeed}-${Date.now()}`,
                                            pokemonName: tier.pokemon.nom,
                                            speed: effSpeed,
                                            bonus: formatTierBonus(tier.bonus) + oppSuffix
                                          }
                                        })}
                                      >
                                        {alreadyAdded ? 'Ajouté' : 'Ajouter'}
                                      </button>
                                    </div>
                                  </div>
                                )
                              })
                            return tr ? filtered.reverse() : filtered
                          }

                          const natSign = activeSlot.natPlus === 'sp' ? '+' : activeSlot.natMinus === 'sp' ? '-' : ''
                          const buildSuffix = (): string => {
                            const parts: string[] = []
                            if (abilityBoostActive) parts.push(translateAbility(currentAbilityName))
                            if (state.tailwind) parts.push('Vent Arrière')
                            if (activeSlot.item === 'Choice Scarf') parts.push('Mouchoir Choix')
                            if (playerBoostStage !== 0) parts.push(`${fmtStage(playerBoostStage)} Vit`)
                            return parts.length ? ' | ' + parts.join(' | ') : ''
                          }
                          const suffix = buildSuffix()
                          const playerBonus = `${speedSP} EV${natSign}${suffix}`

                          const playerAlreadyAdded = activeSlot.speedFilters?.some(f => f.pokemonName === frenchName && f.speed === currentSpeed) ?? false
                          const playerRow = (
                            <div key="player" ref={playerRowRef} className="speed-tier-row player">
                              <div className="tier-col-speed">{currentSpeed}</div>
                              <div className="tier-col-name">{frenchName}</div>
                              <div className="tier-col-details">
                                <span className="tier-comment">{playerBonus}</span>
                              </div>
                              <div className="tier-col-action">
                                <button
                                  type="button"
                                  className={`tier-add-btn${playerAlreadyAdded ? ' added' : ''}`}
                                  disabled={playerAlreadyAdded}
                                  onClick={() => dispatch({
                                    type: 'ADD_SPEED_FILTER',
                                    slot: activeSlotIdx,
                                    filter: {
                                      id: `player-${currentSpeed}-${Date.now()}`,
                                      pokemonName: frenchName,
                                      speed: currentSpeed,
                                      bonus: playerBonus
                                    }
                                  })}
                                >
                                  {playerAlreadyAdded ? 'Ajouté' : 'Ajouter'}
                                </button>
                              </div>
                            </div>
                          )

                          const playerIdx = tr
                            ? speedTiers.findIndex(t => Math.floor(t.speed * oppSpeedMult) < currentSpeed)
                            : speedTiers.findIndex(t => Math.floor(t.speed * oppSpeedMult) <= currentSpeed)
                          const playerInsert = playerIdx === -1 ? speedTiers.length : playerIdx

                          const rows = speedTiers.map((tier, i) => {
                            const effSpeed = Math.floor(tier.speed * oppSpeedMult)
                            const alreadyAdded = activeSlot.speedFilters?.some(f => f.pokemonName === tier.pokemon.nom && f.speed === effSpeed) ?? false
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
                                  <span className="tier-comment">{formatTierBonus(tier.bonus) + oppSuffix}</span>
                                </div>
                                <div className="tier-col-action">
                                  <button
                                    type="button"
                                    className={`tier-add-btn${alreadyAdded ? ' added' : ''}`}
                                    disabled={alreadyAdded}
                                    onClick={() => dispatch({
                                      type: 'ADD_SPEED_FILTER',
                                      slot: activeSlotIdx,
                                      filter: {
                                        id: `${tier.pokemon.name}-${effSpeed}-${Date.now()}`,
                                        pokemonName: tier.pokemon.nom,
                                        speed: effSpeed,
                                        bonus: formatTierBonus(tier.bonus) + oppSuffix
                                      }
                                    })}
                                  >
                                    {alreadyAdded ? 'Ajouté' : 'Ajouter'}
                                  </button>
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

            {/* Panneau de Filtres (Side Right) */}
            <div className="filters-side-panel">
              <div className="filters-container">
                <div className="filters-header">
                  <h3>Filtres</h3>
                </div>
                <div className="speed-filters-section">
                  <div className="filter-group">
                    <div className="filter-group-title">
                      <span>Défensif</span>
                      <button type="button" className="filter-auto-btn" disabled title="Non implémenté">Auto</button>
                    </div>
                    <div className="filter-sub-tabs">
                      <button className={`filter-sub-tab${filterTabs.def === 'custom' ? ' active' : ''}`} onClick={() => setFilterTabs(t => ({ ...t, def: 'custom' }))}>Custom</button>
                      <button className={`filter-sub-tab${filterTabs.def === 'threats' ? ' active' : ''}`} onClick={() => setFilterTabs(t => ({ ...t, def: 'threats' }))}>Common Threats</button>
                    </div>
                    {filterTabs.def === 'custom' && <div className="filter-content-placeholder">Aucun filtre défensif</div>}
                    {filterTabs.def === 'threats' && <div className="filter-content-placeholder">Non implémenté</div>}
                  </div>
                  <div className="filter-group">
                    <div className="filter-group-title">
                      <span>Offensif</span>
                      <button type="button" className="filter-auto-btn" disabled title="Non implémenté">Auto</button>
                    </div>
                    <div className="filter-sub-tabs">
                      <button className={`filter-sub-tab${filterTabs.off === 'custom' ? ' active' : ''}`} onClick={() => setFilterTabs(t => ({ ...t, off: 'custom' }))}>Custom</button>
                      <button className={`filter-sub-tab${filterTabs.off === 'threats' ? ' active' : ''}`} onClick={() => setFilterTabs(t => ({ ...t, off: 'threats' }))}>Common Threats</button>
                    </div>
                    {filterTabs.off === 'custom' && <div className="filter-content-placeholder">Aucun filtre offensif</div>}
                    {filterTabs.off === 'threats' && <div className="filter-content-placeholder">Non implémenté</div>}
                  </div>
                  <div className="filter-group">
                    <div className="filter-group-title">
                      <span>Vitesse</span>
                      <button
                        type="button"
                        className="filter-auto-btn"
                        onClick={handleAutoSpeed}
                        disabled={!activeSlot.speedFilters || activeSlot.speedFilters.length === 0}
                        title="Calcule EVs/Nature pour outspeed les filtres"
                      >
                        Auto
                      </button>
                    </div>
                    <div className="filter-sub-tabs">
                      <button className={`filter-sub-tab${filterTabs.speed === 'custom' ? ' active' : ''}`} onClick={() => setFilterTabs(t => ({ ...t, speed: 'custom' }))}>Custom</button>
                      <button className={`filter-sub-tab${filterTabs.speed === 'threats' ? ' active' : ''}`} onClick={() => setFilterTabs(t => ({ ...t, speed: 'threats' }))}>Common Threats</button>
                    </div>
                    {filterTabs.speed === 'custom' && (
                      activeSlot.speedFilters && activeSlot.speedFilters.length > 0 ? (
                        <div className="active-filters-list">
                          {[...activeSlot.speedFilters].sort((a, b) => state.trickRoom ? a.speed - b.speed : b.speed - a.speed).map(f => {
                            const tr = state.trickRoom
                            const isOut = tr ? currentSpeed < f.speed : currentSpeed > f.speed
                            const isTie = currentSpeed === f.speed
                            const statusClass = isTie ? 'tied' : isOut ? 'outspeeded' : 'underspeeded'

                            return (
                              <div
                                key={f.id}
                                className={`active-filter-item ${statusClass}`}
                                onMouseEnter={f.bonus ? e => handleFilterEnter(e, f.bonus!) : undefined}
                                onMouseLeave={f.bonus ? handleFilterLeave : undefined}
                              >
                                <span className="filter-item-speed">{f.speed}</span>
                                <div className="filter-item-info">
                                  <span className="filter-item-name">{f.pokemonName}</span>
                                  {f.bonus && <span className="filter-item-bonus">{f.bonus}</span>}
                                </div>
                                <button
                                  className="filter-item-remove"
                                  onClick={() => dispatch({ type: 'REMOVE_SPEED_FILTER', slot: activeSlotIdx, id: f.id })}
                                  title="Retirer le filtre"
                                >
                                  ✕
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="filter-content-placeholder">Aucun filtre vitesse</div>
                      )
                    )}
                    {filterTabs.speed === 'threats' && <div className="filter-content-placeholder">Non implémenté</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-editor-state">
            <p>Veuillez sélectionner un Pokémon pour commencer la configuration.</p>
          </div>
        )}
      </div>

      {filterTooltip && (
        <div ref={filterTooltipRef} className="search-select-desc-tooltip" style={filterTooltip.style}>
          {filterTooltip.text.split('\n').map((line, i, arr) => (
            <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
          ))}
        </div>
      )}

      {confirmNatSwap && (
        <div className="auto-modal-overlay" onClick={() => {
          if (confirmNatSwap.neutralNatPlus !== activeSlot.natPlus)
            dispatch({ type: 'UPDATE_SLOT_FIELD', slot: activeSlotIdx, field: 'natPlus', value: confirmNatSwap.neutralNatPlus })
          if (confirmNatSwap.neutralNatMinus !== activeSlot.natMinus)
            dispatch({ type: 'UPDATE_SLOT_FIELD', slot: activeSlotIdx, field: 'natMinus', value: confirmNatSwap.neutralNatMinus })
          handleUpdateSP('sp', confirmNatSwap.fallbackEv ?? 0)
          setConfirmNatSwap(null)
        }}>
          <div className="auto-modal" onClick={e => e.stopPropagation()}>
            <div className="auto-modal-header">
              <span className="auto-modal-icon">⚠</span>
              <h3>Modification de nature requise</h3>
            </div>
            <div className="auto-modal-body">
              <p className="auto-modal-text">
                Pour outspeed la cible maximale, la nature doit être modifiée :
              </p>
              <div className="auto-modal-natures">
                <div className="auto-modal-nat-block">
                  <span className="auto-modal-nat-tag current">Actuelle</span>
                  <div className={`auto-modal-nat ${confirmNatSwap.tr ? 'minus' : 'plus'} faded`}>
                    <span className="nat-sign">{confirmNatSwap.tr ? '−' : '+'}</span>
                    <span className="nat-stat">{NATURE_STAT_LABELS[confirmNatSwap.conflictStat]}</span>
                  </div>
                </div>
                <span className="auto-modal-arrow">→</span>
                <div className="auto-modal-nat-block">
                  <span className="auto-modal-nat-tag new">Nouvelle</span>
                  <div className={`auto-modal-nat ${confirmNatSwap.tr ? 'minus' : 'plus'}`}>
                    <span className="nat-sign">{confirmNatSwap.tr ? '−' : '+'}</span>
                    <span className="nat-stat">VIT</span>
                  </div>
                </div>
              </div>
              {confirmNatSwap.fallbackEv !== null && confirmNatSwap.fallbackReaches !== null && (
                <p className="auto-modal-note">
                  En refusant : {confirmNatSwap.fallbackEv} EV pour outspeed {confirmNatSwap.fallbackReaches} (cible inférieure).
                </p>
              )}
              {confirmNatSwap.fallbackEv === null && (
                <p className="auto-modal-note warn">
                  En refusant : aucune cible atteignable, EV mis à 0.
                </p>
              )}
            </div>
            <div className="auto-modal-actions">
              <button className="auto-modal-btn cancel" onClick={() => {
                if (confirmNatSwap.neutralNatPlus !== activeSlot.natPlus)
                  dispatch({ type: 'UPDATE_SLOT_FIELD', slot: activeSlotIdx, field: 'natPlus', value: confirmNatSwap.neutralNatPlus })
                if (confirmNatSwap.neutralNatMinus !== activeSlot.natMinus)
                  dispatch({ type: 'UPDATE_SLOT_FIELD', slot: activeSlotIdx, field: 'natMinus', value: confirmNatSwap.neutralNatMinus })
                handleUpdateSP('sp', confirmNatSwap.fallbackEv ?? 0)
                setConfirmNatSwap(null)
              }}>
                Annuler
              </button>
              <button className="auto-modal-btn confirm" onClick={() => {
                applyAutoSwap(confirmNatSwap.tr)
                setConfirmNatSwap(null)
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
