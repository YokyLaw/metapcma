'use client'

import { useAppState } from '../context/AppContext'
import { POKE_DATA } from '../data/pokeData'
import SearchSelect from './TeamPanel/SearchSelect'
import { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react'
import { getUsage, useUsageLoaded } from '../hooks/useUsageData'
import '../styles/teamBuilder.css'

import { MEGA_MAP } from '../data/megaMap'
import { POKEMON_TRANSLATIONS, TYPE_TRANSLATIONS, ABILITY_TRANSLATIONS, ITEM_TRANSLATIONS } from '../data/translations'
import { spriteUrl, getEffectivePokeName, artworkUrl, itemSpriteUrl } from '../calc/teamHelpers'
import { getStats, calcStat } from '../calc/statCalc'
import { getMoveData } from '../calc/moveHelpers'
import { TYPE_EFF } from '../data/typeEff'
import { buildTableRow } from '../calc/damageCalc'
import { NATURE_DATA, NATURE_STATS, NATURE_STAT_LABELS, STAT_KEYS, STAT_LABELS, STAT_BOOST_MULTS, WEATHER_OPTIONS, TERRAIN_OPTIONS } from '../data/constants'
import { useFetchCCForSlot, extractName } from '../hooks/useCC'
import { getAbilityDesc } from '../hooks/useAbilityDesc'
import { getItemList, getItemDesc } from '../hooks/useItemDesc'
import { useSpeedTiers } from '../hooks/useSpeedTiers'
import { useDescTooltip } from '../hooks/useDescTooltip'
import { useAllMoves } from '../hooks/useAllMoves'
import { getMoveMeta, getMoveDesc, getMoveNom } from '../hooks/useMoveMeta'
import type { StatKey, Weather, Terrain } from '../types'

type ConfigTab = 'moves' | 'evs-def' | 'evs-off' | 'evs-spe'

const SPEED_BOOST_ABILITIES = new Set([
  'Swift Swim', 'Chlorophyll', 'Sand Rush', 'Slush Rush',
  'Quick Feet', 'Unburden', 'Surge Surfer',
])

const OFF_BOOST_ABILITIES = new Set([
  'Flash Fire',
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

  const speedFilterCount = activeSlot?.speedFilters?.length ?? 0
  useEffect(() => {
    handleFilterLeave()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedFilterCount])

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
  const displayedName = isViewingMega && megaFormeName
    ? (() => {
        const suffixMatch = megaFormeName.match(/\s+([XY])$/)
        const suffix = suffixMatch ? ` ${suffixMatch[1]}` : ''
        return `Méga-${frenchName}${suffix}`
      })()
    : frenchName
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
  const [offSearch, setOffSearch] = useState('')
  const [moveSearch, setMoveSearch] = useState('')
  const [moveTypeFilter, setMoveTypeFilter] = useState<string>('')
  const [moveCategoryFilter, setMoveCategoryFilter] = useState<string>('')
  const { moves: allMoves, loading: loadingAllMoves } = useAllMoves(activeSlot.pokemon)
  const { tooltip: moveTooltip, tooltipRef: moveTooltipRef, handleEnter: handleMoveEnter, handleLeave: handleMoveLeave } = useDescTooltip()
  const [confirmNatSwap, setConfirmNatSwap] = useState<{
    conflictStat: string
    fallbackEv: number | null
    fallbackReaches: number | null
    fallbackReachesName: string | null
    fallbackIsTie: boolean
    acceptReaches: number | null
    acceptReachesName: string | null
    acceptIsTie: boolean
    neutralNatPlus: string
    neutralNatMinus: string
    tr: boolean
  } | null>(null)
  const [confirmOffNatSwap, setConfirmOffNatSwap] = useState<{
    curNatPlus: string
    curNatMinus: string
    newNatPlus: string
    newNatMinus: string
    candidateStat: 'at' | 'sa'
    acceptOhko: string[]
    acceptAllocAt: number
    acceptAllocSa: number
    fallbackOhko: string[]
    fallbackAllocAt: number
    fallbackAllocSa: number
  } | null>(null)
  const [confirmOffSplit, setConfirmOffSplit] = useState<{
    allocAt: number
    allocSa: number
    ohkoList: string[]
  } | null>(null)
  const [noOhkoInfo, setNoOhkoInfo] = useState<{
    filterNames: string[]
    budget: number
  } | null>(null)
  const speedSP = (activeSlot.sps as Record<string, number>).sp || 0
  const slotTotalSP = Object.values(activeSlot.sps as Record<string, number>).reduce((a, b) => a + b, 0)
  const remainingSP = Math.max(0, 66 - slotTotalSP)
  const isDraggingSpeedRef = useRef(false)
  const lastUpdatedSPRef = useRef<number | null>(null)
  const segmentsContainerRef = useRef<HTMLDivElement>(null)
  const playerRowRef = useRef<HTMLDivElement>(null)
  const tiersListRef = useRef<HTMLDivElement>(null)

  const currentAbilityName = extractName(activeSlot.ability)
  const isSpeedAbility = SPEED_BOOST_ABILITIES.has(currentAbilityName)
  const abilityBoostActive = !!activeSlot.speedAbilityActive && isSpeedAbility
  const isOffAbility = OFF_BOOST_ABILITIES.has(currentAbilityName)
  const offAbilityBoostActive = !!activeSlot.offAbilityActive && isOffAbility

  const [offWeather, setOffWeather] = useState<Weather>(state.weather)
  const [offTerrain, setOffTerrain] = useState<Terrain>(state.terrain)
  const [offGravity, setOffGravity] = useState<boolean>(state.gravity)

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

  useLayoutEffect(() => {
    const list = tiersListRef.current
    const player = playerRowRef.current
    if (!list || !player) return
    const center = () => {
      if (!playerRowRef.current || !tiersListRef.current) return
      const p = playerRowRef.current
      const l = tiersListRef.current
      const targetTop = p.offsetTop - l.clientHeight / 2 + p.offsetHeight / 2
      l.scrollTo({ top: Math.max(0, targetTop), behavior: 'auto' })
    }
    center()
    const raf = requestAnimationFrame(center)
    const ro = new ResizeObserver(center)
    ro.observe(list)
    ro.observe(player)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [currentSpeed, tierSearch, oppSpeedMult, state.trickRoom, speedTiers, activeTab])

  const computeAutoTrial = (np: string, nm: string, strict = false) => {
    if (!displayPokeData) return null
    const filters = activeSlot.speedFilters || []
    if (filters.length === 0) return null
    const tr = state.trickRoom
    const uniqueTargets = Array.from(new Set(filters.map(f => f.speed)))
    const sorted = tr
      ? [...uniqueTargets].sort((a, b) => a - b)
      : [...uniqueTargets].sort((a, b) => b - a)
    const nameFor = (sp: number) =>
      filters.filter(f => f.speed === sp).map(f => f.pokemonName).join(' / ') || null
    for (const t of sorted) {
      for (let ev = 0; ev <= 32; ev++) {
        const sps = { ...activeSlot.sps, sp: ev }
        const raw = getStats(displayPokeData, sps, np, nm).sp
        const s = Math.floor(raw * playerSpeedMult)
        const ok = strict
          ? (tr ? s < t : s > t)
          : (tr ? s <= t : s >= t)
        if (ok) return { ev, reaches: t, topTarget: sorted[0], reachesName: nameFor(t), topTargetName: nameFor(sorted[0]), isTie: s === t }
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
      const cancelResult =
        computeAutoTrial(cancelNatPlus, cancelNatMinus, true) ??
        (isNeutralDiff
          ? computeAutoTrial(cancelNatPlus, cancelNatMinus)
          : currentResult)
      // On accept: simulate swap natures to get reached target name
      let swapNatPlus = activeSlot.natPlus
      let swapNatMinus = activeSlot.natMinus
      if (tr) {
        swapNatMinus = 'sp'
        if (swapNatPlus === 'sp') swapNatPlus = ''
      } else {
        swapNatPlus = 'sp'
        if (swapNatMinus === 'sp') swapNatMinus = ''
      }
      const acceptResult = computeAutoTrial(swapNatPlus, swapNatMinus)
      setConfirmNatSwap({
        conflictStat: conflictField,
        fallbackEv: cancelResult?.ev ?? null,
        fallbackReaches: cancelResult?.reaches ?? null,
        fallbackReachesName: cancelResult?.reachesName ?? null,
        fallbackIsTie: cancelResult?.isTie ?? false,
        acceptReaches: acceptResult?.reaches ?? null,
        acceptReachesName: acceptResult?.reachesName ?? null,
        acceptIsTie: acceptResult?.isTie ?? false,
        neutralNatPlus: cancelNatPlus,
        neutralNatMinus: cancelNatMinus,
        tr,
      })
      return
    }

    applyAutoSwap(tr)
  }

  const computeAutoOffTrial = (np: string, nm: string) => {
    if (!displayPokeData) return null
    const filters = activeSlot.offFilters || []
    if (filters.length === 0) return null

    const sps = activeSlot.sps as Record<string, number>
    const otherSps = (sps.hp || 0) + (sps.df || 0) + (sps.sd || 0) + (sps.sp || 0)
    const budget = Math.max(0, 66 - otherSps)

    const sorted = [...filters].sort((a, b) => (a.minPct ?? 0) - (b.minPct ?? 0))

    const suppressAbility = isOffAbility && !offAbilityBoostActive
    const effectiveAttacker = suppressAbility ? { ...activeSlot, ability: '' } : activeSlot

    let allocAt = 0
    let allocSa = 0
    const ohkoList: string[] = []
    const baseSps = { ...activeSlot.sps, at: 0, sa: 0 }

    for (const f of sorted) {
      const info = baselineBestMove.get(f.pokemonName)
      if (!info) continue
      const statKey: 'at' | 'sa' = info.category === 'Physical' ? 'at' : 'sa'
      const curAlloc = statKey === 'at' ? allocAt : allocSa
      const remStat = 32 - curAlloc
      const remBudget = budget - allocAt - allocSa
      const maxTry = Math.min(remStat, remBudget)
      if (maxTry < 0) continue
      const defData = POKE_DATA[info.englishName]
      if (!defData) continue

      let foundEv: number | null = null
      for (let extra = 0; extra <= maxTry; extra++) {
        const tryEv = curAlloc + extra
        const trySps = { ...baseSps, at: allocAt, sa: allocSa, [statKey]: tryEv }
        const atkStats = getStats(displayPokeData, trySps, np, nm)
        const row = buildTableRow(
          effectiveAttacker,
          atkStats,
          info.englishName,
          defData,
          {},
          offWeather,
          offTerrain,
          offGravity,
          state.battleFormat === 'doubles',
          defData.ab,
          state.helpingHand,
          state.auroraVeil,
          state.reflect,
          state.lightScreen,
          state.tailwind,
          ''
        )
        if (!row) continue
        const mr = (row.moveResults as any[])[info.idx]
        if (mr?.calc && mr.calc.minPct >= 100) {
          foundEv = tryEv
          break
        }
      }
      if (foundEv !== null) {
        if (statKey === 'at') allocAt = foundEv
        else allocSa = foundEv
        ohkoList.push(f.pokemonName)
      }
    }
    return { allocAt, allocSa, ohkoList, budget }
  }

  const applyOffAlloc = (allocAt: number, allocSa: number) => {
    handleUpdateSP('at', 0)
    handleUpdateSP('sa', 0)
    if (allocAt > 0) handleUpdateSP('at', allocAt)
    if (allocSa > 0) handleUpdateSP('sa', allocSa)
  }

  const handleAutoOff = () => {
    if (!displayPokeData) return
    const filters = activeSlot.offFilters || []
    if (filters.length === 0) return
    if (!moveCategoryInfo.hasAttacking) return

    const curResult = computeAutoOffTrial(activeSlot.natPlus, activeSlot.natMinus)
    if (!curResult) return

    const sortedFilters = [...filters].sort((a, b) => (a.minPct ?? 0) - (b.minPct ?? 0))
    const hardest = sortedFilters[0]
    const hardestInfo = hardest ? baselineBestMove.get(hardest.pokemonName) : null
    const candidateStat: 'at' | 'sa' | null = hardestInfo
      ? (hardestInfo.category === 'Physical' ? 'at' : 'sa')
      : null

    let candResult: ReturnType<typeof computeAutoOffTrial> = null
    let newNatPlus = activeSlot.natPlus
    let newNatMinus = activeSlot.natMinus
    if (candidateStat && activeSlot.natPlus !== candidateStat) {
      newNatPlus = candidateStat
      newNatMinus = activeSlot.natMinus === candidateStat ? '' : activeSlot.natMinus
      candResult = computeAutoOffTrial(newNatPlus, newNatMinus)
    }

    if (
      curResult.ohkoList.length === 0 &&
      (!candResult || candResult.ohkoList.length === 0)
    ) {
      setNoOhkoInfo({
        filterNames: filters.map(f => f.pokemonName),
        budget: curResult.budget,
      })
      return
    }

    if (
      candResult &&
      candResult.ohkoList.length > curResult.ohkoList.length &&
      candidateStat
    ) {
      setConfirmOffNatSwap({
        curNatPlus: activeSlot.natPlus,
        curNatMinus: activeSlot.natMinus,
        newNatPlus,
        newNatMinus,
        candidateStat,
        acceptOhko: candResult.ohkoList,
        acceptAllocAt: candResult.allocAt,
        acceptAllocSa: candResult.allocSa,
        fallbackOhko: curResult.ohkoList,
        fallbackAllocAt: curResult.allocAt,
        fallbackAllocSa: curResult.allocSa,
      })
      return
    }

    if (curResult.allocAt > 0 && curResult.allocSa > 0) {
      setConfirmOffSplit({
        allocAt: curResult.allocAt,
        allocSa: curResult.allocSa,
        ohkoList: curResult.ohkoList,
      })
      return
    }

    applyOffAlloc(curResult.allocAt, curResult.allocSa)
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

  // ===== Offensive EVs =====
  const moveCategoryInfo = useMemo(() => {
    let phys = 0, spec = 0
    for (const m of activeSlot.moves) {
      if (!m) continue
      const md = getMoveData(m)
      if (!md || !md.bp || md.bp <= 0 || md.category === 'Status') continue
      if (md.category === 'Physical') phys++
      else if (md.category === 'Special') spec++
    }
    const hasAttacking = phys + spec > 0
    const showAt = hasAttacking && phys >= spec && phys > 0
    const showSa = hasAttacking && spec >= phys && spec > 0
    return { phys, spec, hasAttacking, showAt, showSa }
  }, [activeSlot.moves])

  const offStats: StatKey[] = useMemo(() => {
    const arr: StatKey[] = []
    if (moveCategoryInfo.showAt) arr.push('at')
    if (moveCategoryInfo.showSa) arr.push('sa')
    return arr
  }, [moveCategoryInfo])

  const atkBoostStage = activeSlot.boosts?.at ?? 0
  const spaBoostStage = activeSlot.boosts?.sa ?? 0

  const atkStatsInfo = useMemo(() => {
    if (!displayPokeData) return { jumps: new Set<number>(), wastes: new Set<number>() }
    const baseStatAt50 = Math.floor((displayPokeData.bs.at * 2 + 31) * 0.5) + 5
    const natureBonus = activeSlot.natPlus === 'at' ? 1.1 : activeSlot.natMinus === 'at' ? 0.9 : 1
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

  const spaStatsInfo = useMemo(() => {
    if (!displayPokeData) return { jumps: new Set<number>(), wastes: new Set<number>() }
    const baseStatAt50 = Math.floor((displayPokeData.bs.sa * 2 + 31) * 0.5) + 5
    const natureBonus = activeSlot.natPlus === 'sa' ? 1.1 : activeSlot.natMinus === 'sa' ? 0.9 : 1
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

  const isDraggingOffRef = useRef<Record<string, boolean>>({ at: false, sa: false })
  const lastUpdatedOffRef = useRef<Record<string, number | null>>({ at: null, sa: null })
  const offSegmentsRefs = {
    at: useRef<HTMLDivElement>(null),
    sa: useRef<HTMLDivElement>(null),
  } as const

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      for (const k of ['at', 'sa'] as StatKey[]) {
        if (!isDraggingOffRef.current[k]) continue
        const ref = offSegmentsRefs[k as 'at' | 'sa'].current
        if (!ref) continue
        const rect = ref.getBoundingClientRect()
        const x = e.clientX - rect.left
        let val = Math.ceil((x / rect.width) * 32)
        val = Math.max(0, Math.min(32, val))
        if (lastUpdatedOffRef.current[k] !== val) {
          handleUpdateSP(k, val)
          lastUpdatedOffRef.current[k] = val
        }
      }
    }
    const handleUp = () => {
      isDraggingOffRef.current = { at: false, sa: false }
      lastUpdatedOffRef.current = { at: null, sa: null }
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [activeSlotIdx])

  const handleOffMouseDown = (stat: 'at' | 'sa', e: React.MouseEvent) => {
    const ref = offSegmentsRefs[stat].current
    if (!ref) return
    e.preventDefault()
    isDraggingOffRef.current[stat] = true
    const rect = ref.getBoundingClientRect()
    const x = e.clientX - rect.left
    let val = Math.ceil((x / rect.width) * 32)
    val = Math.max(0, Math.min(32, val))
    handleUpdateSP(stat, val)
    lastUpdatedOffRef.current[stat] = val
  }

  const offDamageRows = useMemo(() => {
    if (!displayPokeData || !moveCategoryInfo.hasAttacking) return [] as Array<{ name: string; nom: string; percent: number | null; row: any }>
    const atkStats = getStats(displayPokeData, activeSlot.sps, activeSlot.natPlus, activeSlot.natMinus)
    const suppressAbility = isOffAbility && !offAbilityBoostActive
    const effectiveAttacker = suppressAbility ? { ...activeSlot, ability: '' } : activeSlot
    const seen = new Set<string>()
    const out: Array<{ name: string; nom: string; percent: number | null; row: any }> = []
    for (const tier of speedTiers) {
      const name = tier.pokemon.name
      if (seen.has(name)) continue
      seen.add(name)
      const defData = POKE_DATA[name]
      if (!defData) continue
      const row = buildTableRow(
        effectiveAttacker,
        atkStats,
        name,
        defData,
        {},
        offWeather,
        offTerrain,
        offGravity,
        state.battleFormat === 'doubles',
        defData.ab,
        state.helpingHand,
        state.auroraVeil,
        state.reflect,
        state.lightScreen,
        state.tailwind,
        ''
      )
      if (!row) continue
      out.push({ name, nom: tier.pokemon.nom, percent: tier.percent, row })
    }
    out.sort((a, b) => b.row.maxPct - a.row.maxPct)
    return out
  }, [displayPokeData, activeSlot, speedTiers, offWeather, offTerrain, offGravity, state.battleFormat, state.helpingHand, state.auroraVeil, state.reflect, state.lightScreen, state.tailwind, moveCategoryInfo.hasAttacking, isOffAbility, offAbilityBoostActive])

  const offLiveStats = useMemo(() => {
    const m = new Map<string, { tier: import('../types').OffTier; minPct: number; maxPct: number }>()
    for (const { nom, row } of offDamageRows) {
      const slots = [0, 1, 2, 3].map(i => (row.moveResults as any[])[i] ?? null)
      let bestTier: import('../types').OffTier | undefined
      let bestMin = 0
      let bestMax = 0
      let bestScore = -Infinity
      for (const mr of slots) {
        const calc = mr?.calc
        if (!calc) continue
        const t: import('../types').OffTier =
          calc.minPct >= 100 ? 'ohko' :
          calc.maxPct >= 100 ? 'ko-poss' :
          calc.minPct >= 50  ? 'ko-mid' :
          calc.minPct >= 25  ? 'ko' :
          'ko-low'
        const rank = t === 'ohko' ? 4 : t === 'ko-poss' ? 3 : t === 'ko-mid' ? 2 : t === 'ko' ? 1 : 0
        const score = rank * 1000 + (calc.minPct ?? 0)
        if (score > bestScore) {
          bestScore = score
          bestTier = t
          bestMin = calc.minPct
          bestMax = calc.maxPct
        }
      }
      if (bestTier) m.set(nom, { tier: bestTier, minPct: bestMin, maxPct: bestMax })
    }
    return m
  }, [offDamageRows])

  const frenchToEnglish = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of speedTiers) m.set(t.pokemon.nom, t.pokemon.name)
    return m
  }, [speedTiers])

  const baselineBestMove = useMemo(() => {
    const m = new Map<string, { englishName: string; idx: number; category: 'Physical' | 'Special' }>()
    if (!displayPokeData || !moveCategoryInfo.hasAttacking) return m
    const filters = activeSlot.offFilters || []
    if (filters.length === 0) return m
    const baselineSps = { hp: 0, at: 0, df: 0, sa: 0, sd: 0, sp: 0 }
    const baselineAtkStats = getStats(displayPokeData, baselineSps, '', '')
    const suppressAbility = isOffAbility && !offAbilityBoostActive
    const effectiveAttacker = suppressAbility ? { ...activeSlot, ability: '' } : activeSlot
    for (const f of filters) {
      const englishName = frenchToEnglish.get(f.pokemonName)
      if (!englishName) continue
      const defData = POKE_DATA[englishName]
      if (!defData) continue
      const row = buildTableRow(
        effectiveAttacker,
        baselineAtkStats,
        englishName,
        defData,
        {},
        offWeather,
        offTerrain,
        offGravity,
        state.battleFormat === 'doubles',
        defData.ab,
        state.helpingHand,
        state.auroraVeil,
        state.reflect,
        state.lightScreen,
        state.tailwind,
        ''
      )
      if (!row) continue
      let bestIdx = -1
      let bestMin = -1
      let bestCat: 'Physical' | 'Special' | null = null
      for (let i = 0; i < 4; i++) {
        const mr = (row.moveResults as any[])[i]
        if (!mr?.calc) continue
        const mname = effectiveAttacker.moves[i]
        if (!mname) continue
        const md = getMoveData(mname)
        if (!md || md.category === 'Status' || !md.bp) continue
        if (mr.calc.minPct > bestMin) {
          bestMin = mr.calc.minPct
          bestIdx = i
          bestCat = md.category as 'Physical' | 'Special'
        }
      }
      if (bestIdx >= 0 && bestCat) m.set(f.pokemonName, { englishName, idx: bestIdx, category: bestCat })
    }
    return m
  }, [
    displayPokeData,
    activeSlot.offFilters,
    activeSlot.moves,
    activeSlot.ability,
    activeSlot.item,
    activeSlot.boosts,
    activeSlot.megaForme,
    frenchToEnglish,
    moveCategoryInfo.hasAttacking,
    offWeather,
    offTerrain,
    offGravity,
    state.battleFormat,
    state.helpingHand,
    state.auroraVeil,
    state.reflect,
    state.lightScreen,
    state.tailwind,
    isOffAbility,
    offAbilityBoostActive,
  ])

  const movesUsageMap = useMemo(() => {
    const m = new Map<string, number>()
    const ccm = (activeSlot.ccMoves as unknown as Array<string | { move?: { name?: string }; percent?: number }>) || []
    for (const e of ccm) {
      if (typeof e === 'string') { m.set(e, 0); continue }
      const n = e.move?.name
      if (n) m.set(n, e.percent ?? 0)
    }
    return m
  }, [activeSlot.ccMoves])

  const filteredMoves = useMemo(() => {
    if (!allMoves.length) return [] as string[]
    const megaCat = megaFormeName === 'Mega Charizard X' ? 'Physical'
                  : megaFormeName === 'Mega Charizard Y' ? 'Special'
                  : null
    const q = moveSearch.trim().toLowerCase()
    return allMoves
      .filter(name => {
        if (!megaCat) return true
        const c = getMoveMeta(name)?.category
        return c === megaCat || c === 'Status'
      })
      .filter(name => !q || name.toLowerCase().includes(q) || getMoveNom(name).toLowerCase().includes(q))
      .filter(name => !moveTypeFilter || getMoveMeta(name)?.type === moveTypeFilter)
      .filter(name => !moveCategoryFilter || getMoveMeta(name)?.category === moveCategoryFilter)
      .sort((a, b) => (movesUsageMap.get(b) ?? 0) - (movesUsageMap.get(a) ?? 0))
  }, [allMoves, moveSearch, moveTypeFilter, moveCategoryFilter, megaFormeName, movesUsageMap])

  const coverageBuckets = useMemo(() => {
    const moveTypes: string[] = []
    for (const m of activeSlot.moves) {
      if (!m) continue
      const md = getMoveData(m)
      if (!md || !md.bp || md.bp <= 0 || md.category === 'Status') continue
      if (md.type) moveTypes.push(md.type)
    }
    const buckets: { x4: string[][]; x2: string[][]; x1: string[][]; x05: string[][]; x025: string[][]; x0: string[][] } = {
      x4: [], x2: [], x1: [], x05: [], x025: [], x0: []
    }
    if (moveTypes.length === 0) return { buckets, hasAttacking: false }
    const allTypes = Object.keys(TYPE_EFF)
    const combos: string[][] = allTypes.map(t => [t])
    for (const combo of combos) {
      let best = 0
      for (const mt of moveTypes) {
        let mult = 1
        for (const dt of combo) mult *= TYPE_EFF[mt]?.[dt] ?? 1
        if (mult > best) best = mult
      }
      if (best === 0) buckets.x0.push(combo)
      else if (best === 0.25) buckets.x025.push(combo)
      else if (best === 0.5) buckets.x05.push(combo)
      else if (best === 1) buckets.x1.push(combo)
      else if (best === 2) buckets.x2.push(combo)
      else if (best === 4) buckets.x4.push(combo)
      else buckets.x1.push(combo)
    }
    return { buckets, hasAttacking: true }
  }, [activeSlot.moves])

  const handlePickMove = (name: string) => {
    if (activeSlot.moves.includes(name)) return
    const idx = activeSlot.moves.findIndex(m => !m)
    if (idx === -1) return
    dispatch({ type: 'UPDATE_MOVE', slot: activeSlotIdx, moveIdx: idx, value: name })
  }

  const renderOffSlider = (stat: 'at' | 'sa') => {
    const ev = (activeSlot.sps as Record<string, number>)[stat] || 0
    const info = stat === 'at' ? atkStatsInfo : spaStatsInfo
    const label = stat === 'at' ? 'Attaque' : 'Atq. Spé.'
    return (
      <div className="off-ev-row" key={stat}>
        <div className="off-ev-stat-label">{label}</div>
        <div className="speed-ev-selector-bar">
          <button className="speed-btn reset-btn" onClick={() => handleUpdateSP(stat, 0)} title="Reset (0)">0</button>
          <div
            className="speed-segments-container"
            ref={offSegmentsRefs[stat]}
            onMouseDown={e => handleOffMouseDown(stat, e)}
          >
            {Array.from({ length: 32 }).map((_, i) => {
              const val = i + 1
              const isJump = info.jumps.has(val)
              const isWaste = info.wastes.has(val)
              return (
                <div
                  key={val}
                  className={`speed-segment ${val <= ev ? 'active' : ''} ${isJump ? 'jump' : ''} ${isWaste ? 'waste' : ''}`}
                  title={isJump ? 'Palier Nature (+2)' : isWaste ? 'Perte Nature (+0)' : undefined}
                />
              )
            })}
          </div>
          <button className="speed-btn max-btn" onClick={() => handleUpdateSP(stat, 32)} title="Max (32)">MAX</button>
        </div>
        <div className="speed-ev-value">{ev}</div>
      </div>
    )
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
                    {displayedName}
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
                {(() => {
                  const speedTabContent = (
                  <div className="speed-ev-config">
                    <div className="speed-ev-controls-row">
                      <div className="off-ev-stat-label">Vitesse</div>
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

                      <div className="speed-ev-remaining" title="EVs restants (66 max)">
                        <span className="speed-ev-remaining-text">EVs restant</span>
                        <span className="speed-ev-remaining-value">{remainingSP}</span>
                        <span className="speed-ev-remaining-label">/66</span>
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
                              <div className="tier-col-name">{displayedName}</div>
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
                  );

                  const offTabContent = !moveCategoryInfo.hasAttacking ? (
                    <div className="off-empty-state">
                      Aucune capacité offensive sélectionnée. Configurez les capacités dans l'onglet « Capacités » pour activer cet onglet.
                    </div>
                  ) : (
                    <div className="off-ev-config">
                      <div className="off-ev-header">
                        <div className="off-ev-sliders">
                          {offStats.map(s => renderOffSlider(s as 'at' | 'sa'))}
                        </div>
                        <div className="speed-ev-remaining" title="EVs restants (66 max)">
                          <span className="speed-ev-remaining-text">EVs restant</span>
                          <span className="speed-ev-remaining-value">{remainingSP}</span>
                          <span className="speed-ev-remaining-label">/66</span>
                        </div>
                      </div>

                      <div className="speed-tiers-toolbar">
                        <div className="speed-toolbar-group">
                          <span className="speed-toolbar-label">Champ</span>
                          <button
                            type="button"
                            className={`speed-toolbar-btn${offGravity ? ' active' : ''}`}
                            onClick={() => setOffGravity(v => !v)}
                            title="Gravité (×1.67 précision, immunités Sol annulées)"
                          >
                            Gravité
                          </button>
                          <select
                            className="speed-toolbar-btn"
                            value={offWeather}
                            onChange={e => setOffWeather(e.target.value as Weather)}
                            title="Météo"
                          >
                            {WEATHER_OPTIONS.map(o => (
                              <option key={o.val} value={o.val}>{o.label}</option>
                            ))}
                          </select>
                          <select
                            className="speed-toolbar-btn"
                            value={offTerrain}
                            onChange={e => setOffTerrain(e.target.value as Terrain)}
                            title="Terrain"
                          >
                            {TERRAIN_OPTIONS.map(o => (
                              <option key={o.val} value={o.val}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="speed-toolbar-group">
                          <span className="speed-toolbar-label">Joueur</span>
                          <button
                            type="button"
                            className={`speed-toolbar-btn${state.helpingHand ? ' active' : ''}`}
                            onClick={() => dispatch({ type: 'SET_HELPING_HAND', value: !state.helpingHand })}
                            title="Coup d'Main (×1.5 dégâts en doubles)"
                          >
                            Coup d'Main
                          </button>
                          {isOffAbility && (
                            <button
                              type="button"
                              className={`speed-toolbar-btn${offAbilityBoostActive ? ' active' : ''}`}
                              onClick={() => dispatch({ type: 'TOGGLE_SLOT_OFF_ABILITY', slot: activeSlotIdx })}
                              title={`${translateAbility(currentAbilityName)} (boost offensif conditionnel)`}
                            >
                              {translateAbility(currentAbilityName)}
                            </button>
                          )}
                        </div>
                        <div className="speed-toolbar-group">
                          <span className="speed-toolbar-label">Adversaire</span>
                          <button
                            type="button"
                            className={`speed-toolbar-btn${state.lightScreen ? ' active' : ''}`}
                            onClick={() => dispatch({ type: 'SET_LIGHT_SCREEN', value: !state.lightScreen })}
                            title="Mur Lumière (réduit dégâts spéciaux)"
                          >
                            Mur Lumière
                          </button>
                          <button
                            type="button"
                            className={`speed-toolbar-btn${state.reflect ? ' active' : ''}`}
                            onClick={() => dispatch({ type: 'SET_REFLECT', value: !state.reflect })}
                            title="Reflet (réduit dégâts physiques)"
                          >
                            Reflet
                          </button>
                          <button
                            type="button"
                            className={`speed-toolbar-btn${state.auroraVeil ? ' active' : ''}`}
                            onClick={() => dispatch({ type: 'SET_AURORA_VEIL', value: !state.auroraVeil })}
                            title="Voile Aurore (réduit dégâts physiques et spéciaux)"
                          >
                            Voile Aurore
                          </button>
                        </div>
                      </div>

                      <div className="speed-tiers-search">
                        <input
                          className="tier-search-input"
                          type="text"
                          placeholder="Rechercher un Pokémon..."
                          value={offSearch}
                          onChange={e => setOffSearch(e.target.value)}
                        />
                      </div>
                      <div className="off-damage-container">
                        <div className="off-damage-header">
                          <div className="off-col-name">Pokémon</div>
                          {[0, 1, 2, 3].map(i => {
                            const m = activeSlot.moves[i]
                            const meta = m ? getMoveMeta(m) : null
                            const fallback = i === 0 ? '1er' : `${i + 1}e`
                            return (
                              <div
                                key={i}
                                className="off-col-dmg off-col-dmg-head"
                                style={{ color: meta?.type ? `var(--type-${meta.type.toLowerCase()})` : undefined }}
                              >
                                {m ? getMoveNom(m) : fallback}
                              </div>
                            )
                          })}
                          <div className="off-col-action">Filtre</div>
                        </div>
                        <div className="off-damage-list">
                          {loadingSpeedTiers ? (
                            <div className="tiers-loading">Chargement...</div>
                          ) : offDamageRows.length === 0 ? (
                            <div className="tiers-loading">Aucune donnée</div>
                          ) : (() => {
                            const q = offSearch.trim().toLowerCase()
                            const filtered = q
                              ? offDamageRows.filter(r => r.nom.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
                              : offDamageRows
                            if (filtered.length === 0) return <div className="tiers-loading">Aucun résultat</div>
                            return filtered.map(({ name, nom, percent, row }) => {
                            const slots = [0, 1, 2, 3].map(i => (row.moveResults as any[])[i] ?? null)
                            const alreadyAdded = activeSlot.offFilters?.some(f => f.pokemonName === nom) ?? false
                            return (
                              <div key={name} className="off-damage-row">
                                <div className="off-col-name">
                                  {nom}
                                  {percent != null && <span className="tier-usage">{Math.floor(percent)}%</span>}
                                </div>
                                {slots.map((mr, i) => {
                                  const calc = mr?.calc
                                  const tierCls = !calc ? '' :
                                    calc.minPct >= 100 ? ' tier-ohko' :
                                    calc.maxPct >= 100 ? ' tier-ko-poss' :
                                    calc.minPct >= 50  ? ' tier-ko-mid' :
                                    calc.minPct >= 25  ? ' tier-ko' :
                                    ' tier-ko-low'
                                  return (
                                    <div key={i} className={`off-col-dmg${tierCls}`}>
                                      {mr && calc ? (
                                        <span className="off-dmg-pct">{calc.minPct.toFixed(1)}–{calc.maxPct.toFixed(1)}%</span>
                                      ) : mr ? (
                                        <span className="off-dmg-na">{mr.immune ? 'Immun' : '–'}</span>
                                      ) : (
                                        <span className="off-dmg-na">–</span>
                                      )}
                                    </div>
                                  )
                                })}
                                {(() => {
                                  let bestTier: import('../types').OffTier | undefined
                                  let bestMin: number | undefined
                                  let bestMax: number | undefined
                                  let bestScore = -Infinity
                                  for (const mr of slots) {
                                    const calc = (mr as any)?.calc
                                    if (!calc) continue
                                    const t: import('../types').OffTier =
                                      calc.minPct >= 100 ? 'ohko' :
                                      calc.maxPct >= 100 ? 'ko-poss' :
                                      calc.minPct >= 50  ? 'ko-mid' :
                                      calc.minPct >= 25  ? 'ko' :
                                      'ko-low'
                                    const rank = t === 'ohko' ? 4 : t === 'ko-poss' ? 3 : t === 'ko-mid' ? 2 : t === 'ko' ? 1 : 0
                                    const score = rank * 1000 + (calc.minPct ?? 0)
                                    if (score > bestScore) {
                                      bestScore = score
                                      bestTier = t
                                      bestMin = calc.minPct
                                      bestMax = calc.maxPct
                                    }
                                  }
                                  return (
                                <div className="off-col-action">
                                  <button
                                    type="button"
                                    className={`tier-add-btn${alreadyAdded ? ' added' : ''}`}
                                    disabled={alreadyAdded}
                                    onClick={() => dispatch({
                                      type: 'ADD_OFF_FILTER',
                                      slot: activeSlotIdx,
                                      filter: {
                                        id: `${name}-${Date.now()}`,
                                        pokemonName: nom,
                                        tier: bestTier,
                                        minPct: bestMin,
                                        maxPct: bestMax,
                                      }
                                    })}
                                  >
                                    {alreadyAdded ? 'Ajouté' : 'Ajouter'}
                                  </button>
                                </div>
                                  )
                                })()}
                              </div>
                            )
                          })
                          })()}
                        </div>
                      </div>
                    </div>
                  );

                  return (
                    <>
                      {activeTab === 'moves' && (
                        <div className="moves-tab">
                          <div className="moves-slots-row">
                            {activeSlot.moves.map((m, i) => (
                              <div
                                key={i}
                                className={`move-slot-card${!m ? ' empty' : ''}`}
                                onClick={() => m && dispatch({ type: 'UPDATE_MOVE', slot: activeSlotIdx, moveIdx: i, value: '' })}
                                title={m ? 'Cliquer pour retirer' : 'Slot vide'}
                              >
                                {m ? (() => {
                                  const meta = getMoveMeta(m)
                                  return (
                                    <>
                                      <span className="move-slot-name" style={{ color: meta?.type ? `var(--type-${meta.type.toLowerCase()})` : undefined }}>{getMoveNom(m)}</span>
                                      {meta?.bp ? <span className="move-slot-bp">{meta.bp}</span> : null}
                                      <span className="move-slot-clear">✕</span>
                                    </>
                                  )
                                })() : (
                                  <span className="move-slot-empty">Slot {i + 1}</span>
                                )}
                              </div>
                            ))}
                          </div>

                          {coverageBuckets.hasAttacking && (
                            <div className="coverage-summary">
                              {([
                                { key: 'x2', label: '×2', cls: 'cov-x2' },
                                { key: 'x05', label: '÷2', cls: 'cov-x05' },
                                { key: 'x0', label: 'Immun', cls: 'cov-x0' },
                              ] as const).map(({ key, label, cls }) => {
                                const list = coverageBuckets.buckets[key]
                                return (
                                  <div key={key} className={`coverage-row ${cls}`}>
                                    <span className="coverage-mult">{label}</span>
                                    <div className="coverage-chips">
                                      {list.map((combo, i) => (
                                        <span key={i} className="coverage-chip">
                                          {combo.map((t, j) => (
                                            <span
                                              key={j}
                                              className="coverage-type"
                                              style={{ background: `var(--type-${t.toLowerCase()})` }}
                                              title={TYPE_TRANSLATIONS[t] || t}
                                            >
                                              {TYPE_TRANSLATIONS[t] || t}
                                            </span>
                                          ))}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          <div className="moves-separator" />

                          <div className="moves-toolbar">
                            <div className="moves-toolbar-field moves-toolbar-search">
                              <label className="moves-toolbar-label">Recherche</label>
                              <input
                                className="tier-search-input"
                                type="text"
                                placeholder="Nom de la capacité..."
                                value={moveSearch}
                                onChange={e => setMoveSearch(e.target.value)}
                              />
                            </div>
                            <div className="moves-toolbar-field moves-toolbar-types">
                              <label className="moves-toolbar-label moves-type-cell-label">Type</label>
                              <button
                                type="button"
                                className={`moves-type-chip all${!moveTypeFilter ? ' active' : ''}`}
                                onClick={() => setMoveTypeFilter('')}
                                title="Tous types"
                              >Tous</button>
                              {Object.keys(TYPE_TRANSLATIONS).map(t => (
                                <button
                                  key={t}
                                  type="button"
                                  className={`moves-type-chip${moveTypeFilter === t ? ' active' : ''}`}
                                  onClick={() => setMoveTypeFilter(moveTypeFilter === t ? '' : t)}
                                  title={TYPE_TRANSLATIONS[t]}
                                  style={{ background: `var(--type-${t.toLowerCase()})` }}
                                >
                                  {TYPE_TRANSLATIONS[t]}
                                </button>
                              ))}
                            </div>
                            <div className="moves-toolbar-field moves-toolbar-cats">
                              <label className="moves-toolbar-label">Catégorie</label>
                              <div className="moves-cat-chips">
                                {([
                                  { v: '', l: 'Toutes' },
                                  { v: 'Physical', l: 'Physique' },
                                  { v: 'Special', l: 'Spécial' },
                                  { v: 'Status', l: 'Statut' },
                                ] as const).map(o => (
                                  <button
                                    key={o.v}
                                    type="button"
                                    className={`moves-cat-chip${moveCategoryFilter === o.v ? ' active' : ''}${o.v ? ` cat-${o.v.toLowerCase()}` : ''}`}
                                    onClick={() => setMoveCategoryFilter(o.v)}
                                  >
                                    {o.l}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {loadingAllMoves ? (
                            <div className="tiers-loading">Chargement des capacités...</div>
                          ) : filteredMoves.length === 0 ? (
                            <div className="tiers-loading">Aucune capacité trouvée</div>
                          ) : (
                            <div className="moves-grid">
                              {filteredMoves.map(name => {
                                const meta = getMoveMeta(name)
                                const desc = getMoveDesc(name) || ''
                                const usage = movesUsageMap.get(name)
                                const isAdded = activeSlot.moves.includes(name)
                                const hasEmpty = activeSlot.moves.some(m => !m)
                                const disabled = isAdded || !hasEmpty
                                return (
                                  <button
                                    key={name}
                                    type="button"
                                    className={`move-card${isAdded ? ' added' : ''}${disabled ? ' disabled' : ''}`}
                                    onClick={() => handlePickMove(name)}
                                    onMouseEnter={desc ? (e => handleMoveEnter(e, desc)) : undefined}
                                    onMouseLeave={handleMoveLeave}
                                    disabled={disabled}
                                    style={{ borderLeftColor: meta?.type ? `var(--type-${meta.type.toLowerCase()})` : undefined }}
                                  >
                                    <div className="move-card-head">
                                      <span className="move-card-name">{getMoveNom(name)}</span>
                                      {usage != null && usage > 0 && (
                                        <span className="move-card-usage">{Math.floor(usage)}%</span>
                                      )}
                                    </div>
                                    <div className="move-card-meta">
                                      {meta?.type && (
                                        <span
                                          className="move-card-type"
                                          style={{ background: `var(--type-${meta.type.toLowerCase()})` }}
                                        >
                                          {TYPE_TRANSLATIONS[meta.type] || meta.type}
                                        </span>
                                      )}
                                      {meta?.category && (
                                        <span className={`move-card-cat cat-${meta.category.toLowerCase()}`}>
                                          {meta.category === 'Physical' ? 'Phys' : meta.category === 'Special' ? 'Spé' : 'Stat'}
                                        </span>
                                      )}
                                      {meta?.bp ? <span className="move-card-bp">BP {meta.bp}</span> : null}
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      {activeTab === 'evs-def' && (
                        <fieldset className="speed-readonly-fieldset" disabled>{speedTabContent}</fieldset>
                      )}
                      {activeTab === 'evs-off' && offTabContent}
                      {activeTab === 'evs-spe' && speedTabContent}
                    </>
                  );
                })()}
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
                      <button
                        type="button"
                        className="filter-auto-btn"
                        onClick={handleAutoOff}
                        disabled={!activeSlot.offFilters || activeSlot.offFilters.length === 0 || !moveCategoryInfo.hasAttacking || !displayPokeData}
                        title="Calcule EVs/Nature pour OHKO les filtres offensifs"
                      >
                        Auto
                      </button>
                    </div>
                    <div className="filter-sub-tabs">
                      <button className={`filter-sub-tab${filterTabs.off === 'custom' ? ' active' : ''}`} onClick={() => setFilterTabs(t => ({ ...t, off: 'custom' }))}>Custom</button>
                      <button className={`filter-sub-tab${filterTabs.off === 'threats' ? ' active' : ''}`} onClick={() => setFilterTabs(t => ({ ...t, off: 'threats' }))}>Common Threats</button>
                    </div>
                    {filterTabs.off === 'custom' && (
                      activeSlot.offFilters && activeSlot.offFilters.length > 0 ? (
                        <div className="active-filters-list">
                          {activeSlot.offFilters.map(f => {
                            const live = offLiveStats.get(f.pokemonName)
                            const tier = live?.tier ?? f.tier
                            const minPct = live?.minPct ?? f.minPct
                            const maxPct = live?.maxPct ?? f.maxPct
                            return (
                            <div key={f.id} className={`active-filter-item${tier ? ` tier-${tier}` : ''}`}>
                              <span className="filter-item-name">{f.pokemonName}</span>
                              {minPct != null && maxPct != null && (
                                <span className="filter-item-pct">{minPct.toFixed(1)}–{maxPct.toFixed(1)}%</span>
                              )}
                              <button
                                type="button"
                                className="filter-item-remove"
                                onClick={() => dispatch({ type: 'REMOVE_OFF_FILTER', slot: activeSlotIdx, id: f.id })}
                                aria-label="Retirer"
                              >✕</button>
                            </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="filter-content-placeholder">Aucun filtre offensif</div>
                      )
                    )}
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
                                  onClick={() => {
                                    handleFilterLeave()
                                    dispatch({ type: 'REMOVE_SPEED_FILTER', slot: activeSlotIdx, id: f.id })
                                  }}
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

      {moveTooltip && (
        <div ref={moveTooltipRef} className="search-select-desc-tooltip" style={moveTooltip.style}>
          {moveTooltip.text.split('\n').map((line, i, arr) => (
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
                {confirmNatSwap.acceptReachesName
                  ? <>Pour {confirmNatSwap.acceptIsTie ? 'égaliser' : 'dépasser'} <strong>{confirmNatSwap.acceptReachesName}</strong> ({confirmNatSwap.acceptReaches}), la nature doit être modifiée :</>
                  : <>Pour dépasser la cible maximale, la nature doit être modifiée :</>}
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
                  En refusant : {confirmNatSwap.fallbackEv} EV pour {confirmNatSwap.fallbackIsTie ? 'égaliser' : 'dépasser'}{' '}
                  {confirmNatSwap.fallbackReachesName
                    ? <><strong>{confirmNatSwap.fallbackReachesName}</strong> ({confirmNatSwap.fallbackReaches})</>
                    : confirmNatSwap.fallbackReaches}
                  {' '}(cible inférieure).
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

      {noOhkoInfo && (
        <div className="auto-modal-overlay" onClick={() => setNoOhkoInfo(null)}>
          <div className="auto-modal" onClick={e => e.stopPropagation()}>
            <div className="auto-modal-header">
              <span className="auto-modal-icon">⚠</span>
              <h3>Aucun OHKO possible</h3>
            </div>
            <div className="auto-modal-body">
              <p className="auto-modal-text">
                Aucun OHKO possible sur <strong>{noOhkoInfo.filterNames.join(', ')}</strong> avec les EVs restants ({noOhkoInfo.budget} dispo). Pas de modification.
              </p>
            </div>
            <div className="auto-modal-actions">
              <button className="auto-modal-btn confirm" onClick={() => setNoOhkoInfo(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOffSplit && (
        <div className="auto-modal-overlay" onClick={() => setConfirmOffSplit(null)}>
          <div className="auto-modal" onClick={e => e.stopPropagation()}>
            <div className="auto-modal-header">
              <span className="auto-modal-icon">⚠</span>
              <h3>Répartition Atk / Atq. Spé.</h3>
            </div>
            <div className="auto-modal-body">
              <p className="auto-modal-text">
                Pour OHKO <strong>{confirmOffSplit.ohkoList.join(', ')}</strong>, attribution&nbsp;:
              </p>
              <ul className="auto-modal-list">
                {confirmOffSplit.allocAt > 0 && <li>{confirmOffSplit.allocAt} EV en Attaque</li>}
                {confirmOffSplit.allocSa > 0 && <li>{confirmOffSplit.allocSa} EV en Atq. Spé.</li>}
              </ul>
            </div>
            <div className="auto-modal-actions">
              <button className="auto-modal-btn cancel" onClick={() => setConfirmOffSplit(null)}>
                Annuler
              </button>
              <button className="auto-modal-btn confirm" onClick={() => {
                applyOffAlloc(confirmOffSplit.allocAt, confirmOffSplit.allocSa)
                setConfirmOffSplit(null)
              }}>
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOffNatSwap && (
        <div className="auto-modal-overlay" onClick={() => {
          applyOffAlloc(confirmOffNatSwap.fallbackAllocAt, confirmOffNatSwap.fallbackAllocSa)
          setConfirmOffNatSwap(null)
        }}>
          <div className="auto-modal" onClick={e => e.stopPropagation()}>
            <div className="auto-modal-header">
              <span className="auto-modal-icon">⚠</span>
              <h3>Modification de nature requise</h3>
            </div>
            <div className="auto-modal-body">
              <p className="auto-modal-text">
                Pour OHKO <strong>{confirmOffNatSwap.acceptOhko.join(', ')}</strong>, la nature doit être modifiée&nbsp;:
              </p>
              <div className="auto-modal-natures">
                <div className="auto-modal-nat-block">
                  <span className="auto-modal-nat-tag current">Actuelle</span>
                  <div className="auto-modal-nat plus faded">
                    <span className="nat-sign">+</span>
                    <span className="nat-stat">{confirmOffNatSwap.curNatPlus ? NATURE_STAT_LABELS[confirmOffNatSwap.curNatPlus] : '—'}</span>
                  </div>
                </div>
                <span className="auto-modal-arrow">→</span>
                <div className="auto-modal-nat-block">
                  <span className="auto-modal-nat-tag new">Nouvelle</span>
                  <div className="auto-modal-nat plus">
                    <span className="nat-sign">+</span>
                    <span className="nat-stat">{NATURE_STAT_LABELS[confirmOffNatSwap.candidateStat]}</span>
                  </div>
                </div>
              </div>
              {confirmOffNatSwap.fallbackOhko.length > 0 ? (
                <p className="auto-modal-note">
                  En refusant&nbsp;: OHKO sur <strong>{confirmOffNatSwap.fallbackOhko.join(', ')}</strong>
                  {(confirmOffNatSwap.fallbackAllocAt > 0 || confirmOffNatSwap.fallbackAllocSa > 0) && (
                    <> ({confirmOffNatSwap.fallbackAllocAt > 0 ? `${confirmOffNatSwap.fallbackAllocAt} EV Atk` : ''}
                    {confirmOffNatSwap.fallbackAllocAt > 0 && confirmOffNatSwap.fallbackAllocSa > 0 ? ' + ' : ''}
                    {confirmOffNatSwap.fallbackAllocSa > 0 ? `${confirmOffNatSwap.fallbackAllocSa} EV Atq. Spé.` : ''})</>
                  )}.
                </p>
              ) : (
                <p className="auto-modal-note warn">
                  En refusant&nbsp;: aucun OHKO atteignable, EVs offensifs mis à 0.
                </p>
              )}
            </div>
            <div className="auto-modal-actions">
              <button className="auto-modal-btn cancel" onClick={() => {
                applyOffAlloc(confirmOffNatSwap.fallbackAllocAt, confirmOffNatSwap.fallbackAllocSa)
                setConfirmOffNatSwap(null)
              }}>
                Annuler
              </button>
              <button className="auto-modal-btn confirm" onClick={() => {
                if (confirmOffNatSwap.newNatPlus !== activeSlot.natPlus)
                  dispatch({ type: 'UPDATE_SLOT_FIELD', slot: activeSlotIdx, field: 'natPlus', value: confirmOffNatSwap.newNatPlus })
                if (confirmOffNatSwap.newNatMinus !== activeSlot.natMinus)
                  dispatch({ type: 'UPDATE_SLOT_FIELD', slot: activeSlotIdx, field: 'natMinus', value: confirmOffNatSwap.newNatMinus })
                applyOffAlloc(confirmOffNatSwap.acceptAllocAt, confirmOffNatSwap.acceptAllocSa)
                setConfirmOffNatSwap(null)
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
