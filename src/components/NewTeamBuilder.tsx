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
import { useTopAbilities } from '../hooks/useTopAbilities'
import { useTopMoves } from '../hooks/useTopMoves'
import { useTopSpreads, type TopSpread } from '../hooks/useTopSpreads'
import { useDescTooltip } from '../hooks/useDescTooltip'
import { useAllMoves } from '../hooks/useAllMoves'
import { getMoveMeta, getMoveDesc, getMoveNom } from '../hooks/useMoveMeta'
import type { StatKey, Weather, Terrain, TeamSlot } from '../types'

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

type Repartition = 'none' | 'vig' | 'tank_df' | 'tank_df+' | 'tank_sd' | 'tank_sd+'

const REPARTITION_OPTIONS: { val: Repartition; label: string }[] = [
  { val: 'none', label: 'Sans Investissements' },
  { val: 'vig', label: 'Vigueur (32 HP)' },
  { val: 'tank_df', label: 'Tank Def (32 HP | 32 DEF)' },
  { val: 'tank_df+', label: 'Tank Def+ (32 HP | 32 DEF+)' },
  { val: 'tank_sd', label: 'Tank SpD (32 HP | 32 SpD)' },
  { val: 'tank_sd+', label: 'Tank SpD+ (32 HP | 32 SpD+)' },
]

const REPARTITION_TAGS: Record<Repartition, string> = {
  'none': '—',
  'vig': '32 HP',
  'tank_df': '32 HP / 32 DEF',
  'tank_df+': '32 HP / 32 DEF+',
  'tank_sd': '32 HP / 32 SpD',
  'tank_sd+': '32 HP / 32 SpD+',
}

function formatRepartitionCell(
  rep: Repartition,
  _bestCat: 'Physical' | 'Special' | '' | undefined,
  screen: boolean,
): string {
  let base: string
  if (rep === 'vig') base = '32/0/0'
  else if (rep === 'tank_df') base = '32/32/0'
  else if (rep === 'tank_df+') base = '32/32+/0'
  else if (rep === 'tank_sd') base = '32/0/32'
  else if (rep === 'tank_sd+') base = '32/0/32+'
  else base = '0/0/0'
  return screen ? `${base} Écran` : base
}

const NAT_MINUS_OPTIONS = NATURE_STATS.map(s => ({
  value: s, label: `-${NATURE_STAT_LABELS[s]}`,
}))

const REPART_EV_LABELS: Record<keyof TopSpread['evs'], string> = {
  hp: 'HP', at: 'ATK', df: 'DEF', sa: 'SpA', sd: 'SpD', sp: 'VIT',
}
const REPART_EV_ORDER: Array<keyof TopSpread['evs']> = ['hp', 'at', 'df', 'sa', 'sd', 'sp']

function categorySums(
  attackerName: string,
  defenderName: string,
  moves: readonly string[],
): { phys: number; spec: number } {
  const a = POKE_DATA[attackerName]
  const d = POKE_DATA[defenderName]
  if (!a || !d) return { phys: 0, spec: 0 }
  const aTypes = [a.t1, a.t2].filter(Boolean) as string[]
  const dTypes = [d.t1, d.t2].filter(Boolean) as string[]
  let phys = 0
  let spec = 0
  for (const m of moves) {
    if (!m) continue
    const md = getMoveData(m)
    if (!md || !md.bp || md.bp <= 0) continue
    if (md.category !== 'Physical' && md.category !== 'Special') continue
    const stab = aTypes.includes(md.type) ? 1.5 : 1
    let eff = 1
    for (const dt of dTypes) {
      const e = TYPE_EFF[md.type]?.[dt]
      eff *= (e == null ? 1 : e)
    }
    if (eff === 0) continue
    const atk = md.category === 'Physical' ? (a.bs.at ?? 0) : (a.bs.sa ?? 0)
    const def = md.category === 'Physical' ? (d.bs.df ?? 0) : (d.bs.sd ?? 0)
    if (def <= 0) continue
    const score = md.bp * stab * eff * (atk / def)
    if (md.category === 'Physical') phys += score
    else spec += score
  }
  return { phys, spec }
}

function pickCommonSpread(spreads: TopSpread[] | undefined): TopSpread | null {
  if (!spreads?.length) return null
  let best = spreads[0]
  for (const s of spreads) if (s.percent > best.percent) best = s
  return best
}

function pickMaxStatSpread(
  spreads: TopSpread[] | undefined,
  stat: keyof TopSpread['evs'],
): TopSpread | null {
  if (!spreads?.length) return null
  let best: TopSpread | null = null
  for (const s of spreads) {
    if (!best
      || s.evs[stat] > best.evs[stat]
      || (s.evs[stat] === best.evs[stat] && s.percent > best.percent)) {
      best = s
    }
  }
  return best
}

function formatSpreadCompact(
  spread: TopSpread | null,
  allowed?: ReadonlyArray<keyof TopSpread['evs']>,
): string {
  if (!spread) return '—'
  const keys = allowed ?? REPART_EV_ORDER
  const parts: string[] = []
  for (const k of keys) {
    const v = spread.evs[k]
    const marker = spread.natPlus === k ? '+' : spread.natMinus === k ? '-' : ''
    if (v > 0 || marker) parts.push(`${v} ${REPART_EV_LABELS[k]}${marker}`)
  }
  return parts.length > 0 ? parts.join(' / ') : '0 EV'
}

const REPART_DEF_TABLE_KEYS: ReadonlyArray<keyof TopSpread['evs']> = ['at', 'sa']
const REPART_OFF_TABLE_KEYS: ReadonlyArray<keyof TopSpread['evs']> = ['hp', 'df', 'sd']

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

  // Modal Selection State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalSlotIdx, setModalSlotIdx] = useState(0)
  const [modalSearch, setModalSearch] = useState('')

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
          disabled: usedPokemonNames.has(n),
        }
      })
  }, [usedPokemonNames, usageLoaded])

  const filteredModalOptions = useMemo(() => {
    const q = modalSearch.toLowerCase().trim()
    return q ? pokeOptions.filter(o => o.label.toLowerCase().includes(q)) : pokeOptions
  }, [pokeOptions, modalSearch])

  const handleSelectSlot = (idx: number) => {
    dispatch({ type: 'SELECT_SLOT', slot: idx })
  }

  const handleOpenModal = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation()
    setModalSlotIdx(idx)
    setModalSearch('')
    setIsModalOpen(true)
  }

  const handleUpdatePoke = (idx: number, name: string) => {
    dispatch({ type: 'UPDATE_SLOT_FIELD', slot: idx, field: 'pokemon', value: name })
    setIsModalOpen(false)
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
  const [tableView, setTableView] = useState<{ off: 'general' | 'filtres' | 'menaces'; speed: 'general' | 'filtres' | 'menaces'; def: 'general' | 'filtres' | 'menaces' }>({ off: 'general', speed: 'general', def: 'general' })
  const [tierSearch, setTierSearch] = useState('')
  const [offSearch, setOffSearch] = useState('')
  const [moveSearch, setMoveSearch] = useState('')
  const [moveTypeFilter, setMoveTypeFilter] = useState<string>('')
  const [moveCategoryFilter, setMoveCategoryFilter] = useState<string>('')
  const [showOnlyBestOffensiveMove, setShowOnlyBestOffensiveMove] = useState(false)
  const { moves: allMoves, loading: loadingAllMoves } = useAllMoves(activeSlot.pokemon)
  const { tooltip: moveTooltip, tooltipRef: moveTooltipRef, handleEnter: handleMoveEnter, handleLeave: handleMoveLeave } = useDescTooltip()
  const [confirmNatSwap, setConfirmNatSwap] = useState<{
    conflictStat: string
    fallbackEv: number | null
    fallbackReaches: number | null
    fallbackReachesName: string | null
    fallbackIsTie: boolean
    fallbackUnreached: string[]
    acceptReaches: number | null
    acceptReachesName: string | null
    acceptIsTie: boolean
    acceptUnreached: string[]
    neutralNatPlus: string
    neutralNatMinus: string
    tr: boolean
    mode: 'unlock' | 'savings'
    impact: {
      lossStat: string
      lossLabel: string
      oldVal: number
      newVal: number
      delta: number
      lostFilters: string[]
      lostKind: 'ohko' | 'outspeed' | null
    } | null
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
    mode: 'unlock' | 'savings'
    impact: {
      lossStat: string
      lossLabel: string
      oldVal: number
      newVal: number
      delta: number
      lostFilters: string[]
      lostKind: 'ohko' | 'outspeed' | null
    } | null
  } | null>(null)
  const [confirmOffSplit, setConfirmOffSplit] = useState<{
    allocAt: number
    allocSa: number
    ohkoList: string[]
  } | null>(null)
  const [noOhkoInfo, setNoOhkoInfo] = useState<{
    filterNames: string[]
    budget: number
    bestMinPct: Record<string, number>
  } | null>(null)
  const [unreachableSpeed, setUnreachableSpeed] = useState<{ names: string[] } | null>(null)
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
  const [weatherModalOpen, setWeatherModalOpen] = useState(false)
  const [terrainModalOpen, setTerrainModalOpen] = useState(false)
  const [offNameSortModalOpen, setOffNameSortModalOpen] = useState(false)
  const [defNameSortModalOpen, setDefNameSortModalOpen] = useState(false)
  const [offMoveSortModalOpen, setOffMoveSortModalOpen] = useState(false)
  const [defMoveSortModalOpen, setDefMoveSortModalOpen] = useState(false)
  const [offDmgSortModalOpen, setOffDmgSortModalOpen] = useState(false)
  const [defDmgSortModalOpen, setDefDmgSortModalOpen] = useState(false)
  const [offRepartModalOpen, setOffRepartModalOpen] = useState(false)
  const [defRepartModalOpen, setDefRepartModalOpen] = useState(false)
  const weatherPopoverRef = useRef<HTMLDivElement>(null)
  const terrainPopoverRef = useRef<HTMLDivElement>(null)
  const offNameSortPopoverRef = useRef<HTMLDivElement>(null)
  const defNameSortPopoverRef = useRef<HTMLDivElement>(null)
  const offMoveSortPopoverRef = useRef<HTMLDivElement>(null)
  const defMoveSortPopoverRef = useRef<HTMLDivElement>(null)
  const offDmgSortPopoverRef = useRef<HTMLDivElement>(null)
  const defDmgSortPopoverRef = useRef<HTMLDivElement>(null)
  const offRepartPopoverRef = useRef<HTMLDivElement>(null)
  const defRepartPopoverRef = useRef<HTMLDivElement>(null)

  const [defWeather, setDefWeather] = useState<Weather>(state.weather)
  const [defTerrain, setDefTerrain] = useState<Terrain>(state.terrain)
  const [defGravity, setDefGravity] = useState<boolean>(state.gravity)
  const [defSearch, setDefSearch] = useState('')
  const [defWeatherModalOpen, setDefWeatherModalOpen] = useState(false)
  const [defTerrainModalOpen, setDefTerrainModalOpen] = useState(false)
  const defWeatherPopoverRef = useRef<HTMLDivElement>(null)
  const defTerrainPopoverRef = useRef<HTMLDivElement>(null)
  const [defSort, setDefSort] = useState<{ key: 'name' | 'usage' | 'damage'; dir: 'asc' | 'desc' }>({ key: 'usage', dir: 'desc' })
  const [showOnlyWorstDefensiveMove, setShowOnlyWorstDefensiveMove] = useState(false)

  useEffect(() => {
    if (!weatherModalOpen && !terrainModalOpen && !defWeatherModalOpen && !defTerrainModalOpen && !offNameSortModalOpen && !defNameSortModalOpen && !offMoveSortModalOpen && !defMoveSortModalOpen && !offDmgSortModalOpen && !defDmgSortModalOpen && !offRepartModalOpen && !defRepartModalOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (weatherModalOpen && weatherPopoverRef.current && !weatherPopoverRef.current.contains(target)) {
        setWeatherModalOpen(false)
      }
      if (terrainModalOpen && terrainPopoverRef.current && !terrainPopoverRef.current.contains(target)) {
        setTerrainModalOpen(false)
      }
      if (defWeatherModalOpen && defWeatherPopoverRef.current && !defWeatherPopoverRef.current.contains(target)) {
        setDefWeatherModalOpen(false)
      }
      if (defTerrainModalOpen && defTerrainPopoverRef.current && !defTerrainPopoverRef.current.contains(target)) {
        setDefTerrainModalOpen(false)
      }
      if (offNameSortModalOpen && offNameSortPopoverRef.current && !offNameSortPopoverRef.current.contains(target)) {
        setOffNameSortModalOpen(false)
      }
      if (defNameSortModalOpen && defNameSortPopoverRef.current && !defNameSortPopoverRef.current.contains(target)) {
        setDefNameSortModalOpen(false)
      }
      if (offMoveSortModalOpen && offMoveSortPopoverRef.current && !offMoveSortPopoverRef.current.contains(target)) {
        setOffMoveSortModalOpen(false)
      }
      if (defMoveSortModalOpen && defMoveSortPopoverRef.current && !defMoveSortPopoverRef.current.contains(target)) {
        setDefMoveSortModalOpen(false)
      }
      if (offDmgSortModalOpen && offDmgSortPopoverRef.current && !offDmgSortPopoverRef.current.contains(target)) {
        setOffDmgSortModalOpen(false)
      }
      if (defDmgSortModalOpen && defDmgSortPopoverRef.current && !defDmgSortPopoverRef.current.contains(target)) {
        setDefDmgSortModalOpen(false)
      }
      if (offRepartModalOpen && offRepartPopoverRef.current && !offRepartPopoverRef.current.contains(target)) {
        setOffRepartModalOpen(false)
      }
      if (defRepartModalOpen && defRepartPopoverRef.current && !defRepartPopoverRef.current.contains(target)) {
        setDefRepartModalOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [weatherModalOpen, terrainModalOpen, defWeatherModalOpen, defTerrainModalOpen, offNameSortModalOpen, defNameSortModalOpen, offMoveSortModalOpen, defMoveSortModalOpen, offDmgSortModalOpen, defDmgSortModalOpen, offRepartModalOpen, defRepartModalOpen])

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

  const solveSpeed = (np: string, nm: string) => {
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

    const speedAt = (ev: number) => {
      const sps = { ...activeSlot.sps, sp: ev }
      const raw = getStats(displayPokeData, sps, np, nm).sp
      return Math.floor(raw * playerSpeedMult)
    }

    for (const t of sorted) {
      for (let ev = 0; ev <= 32; ev++) {
        const s = speedAt(ev)
        const reach = tr ? s <= t : s >= t
        if (!reach) continue
        let bestEv = ev
        let bestS = s
        let kind: 'outspeed' | 'tie' = (tr ? s < t : s > t) ? 'outspeed' : 'tie'
        if (kind === 'tie' && !tr) {
          for (let ev2 = ev + 1; ev2 <= 32; ev2++) {
            const s2 = speedAt(ev2)
            if (s2 > t) {
              bestEv = ev2
              bestS = s2
              kind = 'outspeed'
              break
            }
          }
        }
        let outspeedCount = 0
        let tieCount = 0
        const unreachedNames: string[] = []
        for (const u of uniqueTargets) {
          if (tr ? bestS < u : bestS > u) outspeedCount++
          else if (bestS === u) tieCount++
          else {
            const n = nameFor(u)
            if (n) unreachedNames.push(n)
          }
        }
        return {
          ev: bestEv,
          hardestTarget: t,
          hardestName: nameFor(t),
          kind,
          outspeedCount,
          tieCount,
          unreachedNames,
        }
      }
    }
    return null
  }

  const allFilterNames = () => {
    const filters = activeSlot.speedFilters || []
    return Array.from(new Set(filters.map(f => f.pokemonName)))
  }

  const computeNatImpact = (newNp: string, newNm: string) => {
    if (!displayPokeData) return null
    const oldNp = activeSlot.natPlus
    const oldNm = activeSlot.natMinus
    if (oldNp === newNp || oldNp === '') return null
    const lossStat = oldNp
    const oldStats = getStats(displayPokeData, activeSlot.sps as any, oldNp, oldNm)
    const newStats = getStats(displayPokeData, activeSlot.sps as any, newNp, newNm)
    const oldVal = (oldStats as any)[lossStat] as number
    const newVal = (newStats as any)[lossStat] as number
    const lossLabel = (NATURE_STAT_LABELS as any)[lossStat] || lossStat.toUpperCase()
    const lostFilters: string[] = []
    let lostKind: 'ohko' | 'outspeed' | null = null

    if (lossStat === 'at' || lossStat === 'sa') {
      lostKind = 'ohko'
      const filters = activeSlot.offFilters || []
      const suppressAbility = isOffAbility && !offAbilityBoostActive
      const effectiveAttacker = suppressAbility ? { ...activeSlot, ability: '' } : activeSlot
      const oldAtkStats = oldStats
      const newAtkStats = newStats
      for (const f of filters) {
        const info = baselineBestMove.get(f.pokemonName)
        if (!info) continue
        const defData = POKE_DATA[info.englishName]
        if (!defData) continue
        const oldRow = buildTableRow(effectiveAttacker, oldAtkStats, info.englishName, defData, {}, offWeather, offTerrain, offGravity, state.battleFormat === 'doubles', defData.ab, state.helpingHand, state.auroraVeil, state.reflect, state.lightScreen, state.tailwind, '')
        const oldMr = oldRow ? (oldRow.moveResults as any[])[info.idx] : null
        if (!oldMr?.calc || oldMr.calc.minPct < 100) continue
        const newRow = buildTableRow(effectiveAttacker, newAtkStats, info.englishName, defData, {}, offWeather, offTerrain, offGravity, state.battleFormat === 'doubles', defData.ab, state.helpingHand, state.auroraVeil, state.reflect, state.lightScreen, state.tailwind, '')
        const newMr = newRow ? (newRow.moveResults as any[])[info.idx] : null
        if (!newMr?.calc || newMr.calc.minPct < 100) {
          lostFilters.push(f.pokemonName)
        }
      }
    } else if (lossStat === 'sp') {
      lostKind = 'outspeed'
      const tr = state.trickRoom
      const oldS = Math.floor(oldStats.sp * playerSpeedMult)
      const newS = Math.floor(newStats.sp * playerSpeedMult)
      const filters = activeSlot.speedFilters || []
      for (const f of filters) {
        const wasReach = tr ? oldS <= f.speed : oldS >= f.speed
        const isReach = tr ? newS <= f.speed : newS >= f.speed
        if (wasReach && !isReach) lostFilters.push(f.pokemonName)
      }
    }

    return { lossStat, lossLabel, oldVal, newVal, delta: newVal - oldVal, lostFilters, lostKind }
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
    const result = solveSpeed(newNatPlus, newNatMinus)
    if (!result) {
      const names = allFilterNames()
      if (names.length > 0) setUnreachableSpeed({ names })
      return
    }
    if (newNatPlus !== activeSlot.natPlus) {
      dispatch({ type: 'UPDATE_SLOT_FIELD', slot: activeSlotIdx, field: 'natPlus', value: newNatPlus })
    }
    if (newNatMinus !== activeSlot.natMinus) {
      dispatch({ type: 'UPDATE_SLOT_FIELD', slot: activeSlotIdx, field: 'natMinus', value: newNatMinus })
    }
    handleUpdateSP('sp', result.ev)
    if (result.unreachedNames.length > 0) setUnreachableSpeed({ names: result.unreachedNames })
  }

  const handleAutoSpeed = () => {
    if (!pokeData) return
    const filters = activeSlot.speedFilters || []
    if (filters.length === 0) return

    const tr = state.trickRoom
    const curBest = solveSpeed(activeSlot.natPlus, activeSlot.natMinus)

    let newNatPlus = activeSlot.natPlus
    let newNatMinus = activeSlot.natMinus
    if (tr) {
      newNatMinus = 'sp'
      if (newNatPlus === 'sp') newNatPlus = ''
    } else {
      newNatPlus = 'sp'
      if (newNatMinus === 'sp') newNatMinus = ''
    }
    const natureChanged = newNatPlus !== activeSlot.natPlus || newNatMinus !== activeSlot.natMinus

    if (!natureChanged) {
      if (curBest) {
        handleUpdateSP('sp', curBest.ev)
        if (curBest.unreachedNames.length > 0) setUnreachableSpeed({ names: curBest.unreachedNames })
      } else {
        const names = allFilterNames()
        if (names.length > 0) setUnreachableSpeed({ names })
      }
      return
    }

    const newBest = solveSpeed(newNatPlus, newNatMinus)
    const improves = !!newBest && (
      !curBest ||
      newBest.outspeedCount > curBest.outspeedCount ||
      (newBest.outspeedCount === curBest.outspeedCount && newBest.tieCount > curBest.tieCount)
    )

    if (improves && newBest) {
      const sameHardest = !!curBest && curBest.hardestTarget === newBest.hardestTarget
      const impact = computeNatImpact(newNatPlus, newNatMinus)
      setConfirmNatSwap({
        conflictStat: tr ? activeSlot.natMinus : activeSlot.natPlus,
        fallbackEv: curBest?.ev ?? null,
        fallbackReaches: curBest?.hardestTarget ?? null,
        fallbackReachesName: curBest?.hardestName ?? null,
        fallbackIsTie: curBest?.kind === 'tie',
        fallbackUnreached: curBest?.unreachedNames ?? allFilterNames(),
        acceptReaches: newBest.hardestTarget,
        acceptReachesName: newBest.hardestName,
        acceptIsTie: newBest.kind === 'tie',
        acceptUnreached: newBest.unreachedNames,
        neutralNatPlus: activeSlot.natPlus,
        neutralNatMinus: activeSlot.natMinus,
        tr,
        mode: sameHardest ? 'savings' : 'unlock',
        impact,
      })
      return
    }

    if (curBest) {
      handleUpdateSP('sp', curBest.ev)
      if (curBest.unreachedNames.length > 0) setUnreachableSpeed({ names: curBest.unreachedNames })
    } else {
      const names = allFilterNames()
      if (names.length > 0) setUnreachableSpeed({ names })
    }
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
    const bestMinPctPerFilter = new Map<string, number>()
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
      let bestMinForFilter = 0
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
        if (mr?.calc) {
          if (mr.calc.minPct > bestMinForFilter) bestMinForFilter = mr.calc.minPct
          if (mr.calc.minPct >= 100) {
            foundEv = tryEv
            break
          }
        }
      }
      bestMinPctPerFilter.set(f.pokemonName, bestMinForFilter)
      if (foundEv !== null) {
        if (statKey === 'at') allocAt = foundEv
        else allocSa = foundEv
        ohkoList.push(f.pokemonName)
      }
    }
    return { allocAt, allocSa, ohkoList, budget, bestMinPctPerFilter }
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
      const bestMinPct: Record<string, number> = {}
      for (const f of filters) {
        const a = curResult.bestMinPctPerFilter.get(f.pokemonName) ?? 0
        const b = candResult?.bestMinPctPerFilter.get(f.pokemonName) ?? 0
        bestMinPct[f.pokemonName] = Math.max(a, b)
      }
      setNoOhkoInfo({
        filterNames: filters.map(f => f.pokemonName),
        budget: curResult.budget,
        bestMinPct,
      })
      return
    }

    const curTotal = curResult.allocAt + curResult.allocSa
    const candTotal = candResult ? candResult.allocAt + candResult.allocSa : Infinity
    const candBetter = !!candResult && !!candidateStat && (
      candResult.ohkoList.length > curResult.ohkoList.length ||
      (candResult.ohkoList.length === curResult.ohkoList.length && candTotal < curTotal)
    )

    if (candBetter && candResult && candidateStat) {
      const fallbackSet = new Set(curResult.ohkoList)
      const sameOhko = candResult.ohkoList.length === curResult.ohkoList.length &&
        candResult.ohkoList.every(n => fallbackSet.has(n))
      const impact = computeNatImpact(newNatPlus, newNatMinus)
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
        mode: sameOhko ? 'savings' : 'unlock',
        impact,
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
    const showAt = phys > 0
    const showSa = spec > 0
    return { phys, spec, hasAttacking, showAt, showSa }
  }, [activeSlot.moves])

  useEffect(() => {
    const sps = activeSlot.sps as Record<string, number>
    if (!moveCategoryInfo.showAt && (sps.at || 0) > 0) {
      dispatch({ type: 'UPDATE_SP', slot: activeSlotIdx, stat: 'at', value: 0 })
    }
    if (!moveCategoryInfo.showSa && (sps.sa || 0) > 0) {
      dispatch({ type: 'UPDATE_SP', slot: activeSlotIdx, stat: 'sa', value: 0 })
    }
  }, [moveCategoryInfo.showAt, moveCategoryInfo.showSa, activeSlotIdx, activeSlot.sps, dispatch])

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

  const dfStatsInfo = useMemo(() => {
    if (!displayPokeData) return { jumps: new Set<number>(), wastes: new Set<number>() }
    const baseStatAt50 = Math.floor((displayPokeData.bs.df * 2 + 31) * 0.5) + 5
    const natureBonus = activeSlot.natPlus === 'df' ? 1.1 : activeSlot.natMinus === 'df' ? 0.9 : 1
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

  const sdStatsInfo = useMemo(() => {
    if (!displayPokeData) return { jumps: new Set<number>(), wastes: new Set<number>() }
    const baseStatAt50 = Math.floor((displayPokeData.bs.sd * 2 + 31) * 0.5) + 5
    const natureBonus = activeSlot.natPlus === 'sd' ? 1.1 : activeSlot.natMinus === 'sd' ? 0.9 : 1
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

  const isDraggingDefRef = useRef<Record<string, boolean>>({ hp: false, df: false, sd: false })
  const lastUpdatedDefRef = useRef<Record<string, number | null>>({ hp: null, df: null, sd: null })
  const defSegmentsRefs = {
    hp: useRef<HTMLDivElement>(null),
    df: useRef<HTMLDivElement>(null),
    sd: useRef<HTMLDivElement>(null),
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

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      for (const k of ['hp', 'df', 'sd'] as Array<'hp' | 'df' | 'sd'>) {
        if (!isDraggingDefRef.current[k]) continue
        const ref = defSegmentsRefs[k].current
        if (!ref) continue
        const rect = ref.getBoundingClientRect()
        const x = e.clientX - rect.left
        let val = Math.ceil((x / rect.width) * 32)
        val = Math.max(0, Math.min(32, val))
        if (lastUpdatedDefRef.current[k] !== val) {
          handleUpdateSP(k, val)
          lastUpdatedDefRef.current[k] = val
        }
      }
    }
    const handleUp = () => {
      isDraggingDefRef.current = { hp: false, df: false, sd: false }
      lastUpdatedDefRef.current = { hp: null, df: null, sd: null }
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [activeSlotIdx])

  const handleDefMouseDown = (stat: 'hp' | 'df' | 'sd', e: React.MouseEvent) => {
    const ref = defSegmentsRefs[stat].current
    if (!ref) return
    e.preventDefault()
    isDraggingDefRef.current[stat] = true
    const rect = ref.getBoundingClientRect()
    const x = e.clientX - rect.left
    let val = Math.ceil((x / rect.width) * 32)
    val = Math.max(0, Math.min(32, val))
    handleUpdateSP(stat, val)
    lastUpdatedDefRef.current[stat] = val
  }

  const [offSort, setOffSort] = useState<{ key: 'name' | 'usage' | 'damage'; dir: 'asc' | 'desc' }>({ key: 'usage', dir: 'desc' })

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

    out.sort((a, b) => {
      let diff = 0
      if (offSort.key === 'usage') diff = (b.percent ?? 0) - (a.percent ?? 0)
      else if (offSort.key === 'name') diff = a.nom.localeCompare(b.nom)
      else if (offSort.key === 'damage') diff = b.row.maxPct - a.row.maxPct
      return offSort.dir === 'asc' ? -diff : diff
    })

    return out
  }, [displayPokeData, activeSlot, speedTiers, offWeather, offTerrain, offGravity, state.battleFormat, state.helpingHand, state.auroraVeil, state.reflect, state.lightScreen, state.tailwind, moveCategoryInfo.hasAttacking, isOffAbility, offAbilityBoostActive, offSort])

  const offAbilityNames = useMemo(() => offDamageRows.map(r => r.name), [offDamageRows])
  const offTopAbilities = useTopAbilities(offAbilityNames)
  const offTopSpreads = useTopSpreads(offAbilityNames)

  const handleOffSort = (key: 'name' | 'usage' | 'damage') => {
    setOffSort(prev => ({
      key,
      dir: prev.key === key ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'desc'
    }))
  }

  // ===== Defensive EVs =====
  const defOpponentNames = useMemo(() => speedTiers.map(t => t.pokemon.name), [speedTiers])
  const defTopAbilities = useTopAbilities(defOpponentNames)
  const defTopMoves = useTopMoves(defOpponentNames)
  const defTopSpreads = useTopSpreads(defOpponentNames)

  const defDamageRows = useMemo(() => {
    if (!pokeData || !effectiveName) return [] as Array<{ name: string; nom: string; percent: number | null; row: any }>
    const out: Array<{ name: string; nom: string; percent: number | null; row: any }> = []
    const seen = new Set<string>()

    const override = {
      sp_hp: activeSlot.sps.hp ?? 0,
      sp_df: activeSlot.sps.df ?? 0,
      sp_sd: activeSlot.sps.sd ?? 0,
      sp_at: activeSlot.sps.at ?? 0,
      sp_sa: activeSlot.sps.sa ?? 0,
      sp_sp: activeSlot.sps.sp ?? 0,
      natPlus: activeSlot.natPlus,
      natMinus: activeSlot.natMinus,
      ability: activeSlot.ability,
    }
    const advStatsMap = { [effectiveName]: override }

    for (const tier of speedTiers) {
      const oppName = tier.pokemon.name
      if (seen.has(oppName)) continue
      seen.add(oppName)
      const oppData = POKE_DATA[oppName]
      if (!oppData) continue

      const oppTopAb = defTopAbilities.get(oppName)
      const oppTopMv = defTopMoves.get(oppName) ?? []
      const moveTuple: [string, string, string, string] = [
        oppTopMv[0]?.name || '',
        oppTopMv[1]?.name || '',
        oppTopMv[2]?.name || '',
        oppTopMv[3]?.name || '',
      ]
      if (!moveTuple.some(m => m)) continue

      const synthAttacker: TeamSlot = {
        id: -1,
        pokemon: oppName,
        megaForme: '',
        ability: oppTopAb?.name || oppData.ab || '',
        item: '',
        natPlus: '',
        natMinus: '',
        sps: { hp: 0, at: 0, df: 0, sa: 0, sd: 0, sp: 0 },
        boosts: { at: 0, df: 0, sa: 0, sd: 0, sp: 0 },
        moves: moveTuple,
        ccMoves: null,
        ccItems: null,
        ccAbilities: null,
        ccAllAbilities: null,
        ccNature: null,
        ccSps: null,
        preMegaAbility: '',
        preMegaItem: '',
        useDefaultSet: false,
        preDefaultSet: null,
        speedAbilityActive: false,
        offAbilityActive: false,
        speedFilters: [],
        offFilters: [],
        defFilters: [],
        shiny: false,
      }

      const atkStats = getStats(oppData, synthAttacker.sps, '', '')

      const row = buildTableRow(
        synthAttacker,
        atkStats,
        effectiveName,
        pokeData,
        advStatsMap,
        defWeather,
        defTerrain,
        defGravity,
        state.battleFormat === 'doubles',
        pokeData.ab,
        state.advHelpingHand,
        state.auroraVeil,
        state.reflect,
        state.lightScreen,
        state.advTailwind,
        activeSlot.item && activeSlot.item !== '(No Item)' ? activeSlot.item : ''
      )
      if (!row) continue
      out.push({ name: oppName, nom: tier.pokemon.nom, percent: tier.percent, row })
    }

    out.sort((a, b) => {
      let diff = 0
      if (defSort.key === 'usage') diff = (b.percent ?? 0) - (a.percent ?? 0)
      else if (defSort.key === 'name') diff = a.nom.localeCompare(b.nom)
      else if (defSort.key === 'damage') diff = b.row.maxPct - a.row.maxPct
      return defSort.dir === 'asc' ? -diff : diff
    })

    return out
  }, [pokeData, effectiveName, activeSlot.sps, activeSlot.natPlus, activeSlot.natMinus, activeSlot.ability, activeSlot.item, speedTiers, defTopAbilities, defTopMoves, defWeather, defTerrain, defGravity, state.battleFormat, state.advHelpingHand, state.auroraVeil, state.reflect, state.lightScreen, state.advTailwind, defSort])

  const handleDefSort = (key: 'name' | 'usage' | 'damage') => {
    setDefSort(prev => ({
      key,
      dir: prev.key === key ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'desc'
    }))
  }

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
    const q = moveSearch.trim().toLowerCase()
    return allMoves
      .filter(name => !q || name.toLowerCase().includes(q) || getMoveNom(name).toLowerCase().includes(q))
      .filter(name => !moveTypeFilter || getMoveMeta(name)?.type === moveTypeFilter)
      .filter(name => !moveCategoryFilter || getMoveMeta(name)?.category === moveCategoryFilter)
      .sort((a, b) => (movesUsageMap.get(b) ?? 0) - (movesUsageMap.get(a) ?? 0))
  }, [allMoves, moveSearch, moveTypeFilter, moveCategoryFilter, movesUsageMap])

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
    const existingIdx = activeSlot.moves.findIndex(m => m === name)
    if (existingIdx !== -1) {
      dispatch({ type: 'UPDATE_MOVE', slot: activeSlotIdx, moveIdx: existingIdx, value: '' })
      return
    }
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

  const renderDefSlider = (stat: 'hp' | 'df' | 'sd') => {
    const ev = (activeSlot.sps as Record<string, number>)[stat] || 0
    const info = stat === 'df' ? dfStatsInfo : stat === 'sd' ? sdStatsInfo : { jumps: new Set<number>(), wastes: new Set<number>() }
    const label = stat === 'hp' ? 'PV' : stat === 'df' ? 'Défense' : 'Déf. Spé.'
    return (
      <div className="off-ev-row" key={stat}>
        <div className="off-ev-stat-label">{label}</div>
        <div className="speed-ev-selector-bar">
          <button className="speed-btn reset-btn" onClick={() => handleUpdateSP(stat, 0)} title="Reset (0)">0</button>
          <div
            className="speed-segments-container"
            ref={defSegmentsRefs[stat]}
            onMouseDown={e => handleDefMouseDown(stat, e)}
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
              onClick={() => handleSelectSlot(i)}
            >
              <div className="slot-search-zone" onClick={e => handleOpenModal(e, i)} title="Changer de Pokémon">
                <div className="slot-search-trigger">
                  <svg viewBox="0 0 100 100" width="20" height="20">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8"/>
                    <line x1="5" y1="50" x2="95" y2="50" stroke="currentColor" strokeWidth="8"/>
                    <circle cx="50" cy="50" r="15" fill="var(--card)" stroke="currentColor" strokeWidth="8"/>
                  </svg>
                </div>
              </div>

              <div className="slot-content">
                <div className="slot-main">
                  {hasPoke ? (
                    <>
                      <img className="slot-sprite" src={spriteUrl(slot.pokemon, slot.shiny)} alt="" />
                      <span className="slot-name">{slot.pokemon}</span>
                    </>
                  ) : (
                    <span className="slot-placeholder">Slot {i + 1}</span>
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
                      src={artworkUrl(activeSlot.pokemon, activeSlot.shiny)}
                      alt={activeSlot.pokemon}
                      className="visual-artwork"
                      onError={e => { e.currentTarget.src = spriteUrl(activeSlot.pokemon, activeSlot.shiny) }}
                    />
                    {MEGA_MAP[activeSlot.pokemon] && <div className="base-indicator">BASE</div>}
                  </div>
                  {megaFormeName && (
                    <div
                      className={`visual-image-box mega-artwork form-clickable${viewingMegaForm ? ' form-selected' : ''}`}
                      onClick={() => setViewingMegaForm(true)}
                    >
                      <img
                        src={artworkUrl(megaFormeName, activeSlot.shiny)}
                        alt={megaFormeName}
                        className="visual-artwork"
                        onError={e => { e.currentTarget.src = spriteUrl(megaFormeName, activeSlot.shiny) }}
                      />
                      <div className="mega-indicator">MEGA</div>
                    </div>
                  )}
                </div>
                <div className="visual-info-box">
                  <h2 className="visual-name">
                    {displayedName}
                    <button
                      type="button"
                      className={`shiny-toggle-btn${activeSlot.shiny ? ' shiny-active' : ''}`}
                      title={activeSlot.shiny ? 'Désactiver shiny' : 'Activer shiny'}
                      onClick={() => dispatch({ type: 'UPDATE_SLOT_FIELD', slot: activeSlotIdx, field: 'shiny', value: !activeSlot.shiny })}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill={activeSlot.shiny ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                    </button>
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

              {/* Sélecteurs de base (Fusionné dans le cadre visuel) */}
              <div className="visual-base-controls">
                <div className="form-group nickname-form-group">
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
            </div>

            {/* Zone de configuration (Main) */}
            <div className="config-main-panel">
              {(() => {
                const sps = activeSlot.sps as Record<string, number>
                const hpSP = sps.hp || 0
                const dfSP = sps.df || 0
                const sdSP = sps.sd || 0
                const atSP = sps.at || 0
                const saSP = sps.sa || 0
                const spSP = sps.sp || 0
                const np = activeSlot.natPlus
                const nm = activeSlot.natMinus
                const natClass = (key: string) =>
                  key === np ? 'stat-nat-plus' : key === nm ? 'stat-nat-minus' : ''
                return (
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
                  <span className="tab-link-evs">
                    <span className={natClass('hp')}>HP {hpSP}</span>
                    {' / '}
                    <span className={natClass('df')}>Def {dfSP}</span>
                    {' / '}
                    <span className={natClass('sd')}>SpD {sdSP}</span>
                  </span>
                </button>
                <button
                  className={`tab-link ${activeTab === 'evs-off' ? 'active' : ''}`}
                  onClick={() => setActiveTab('evs-off')}
                >
                  EVs Offensifs
                  <span className="tab-link-evs">
                    <span className={natClass('at')}>Atk {atSP}</span>
                    {' / '}
                    <span className={natClass('sa')}>SpA {saSP}</span>
                  </span>
                </button>
                <button
                  className={`tab-link ${activeTab === 'evs-spe' ? 'active' : ''}`}
                  onClick={() => setActiveTab('evs-spe')}
                >
                  EVs Vitesse
                  <span className="tab-link-evs">
                    <span className={natClass('sp')}>Spe {spSP}</span>
                  </span>
                </button>
              </div>
                );
              })()}

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
                      <div className="filter-sub-tabs table-view-selector">
                        <button className={`filter-sub-tab${tableView.speed === 'general' ? ' active' : ''}`} onClick={() => setTableView(v => ({ ...v, speed: 'general' }))}>Général</button>
                        <button className={`filter-sub-tab${tableView.speed === 'filtres' ? ' active' : ''}`} onClick={() => setTableView(v => ({ ...v, speed: 'filtres' }))}>Filtres</button>
                        <button className={`filter-sub-tab${tableView.speed === 'menaces' ? ' active' : ''}`} onClick={() => setTableView(v => ({ ...v, speed: 'menaces' }))}>Menaces</button>
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
                      {tableView.speed === 'filtres' ? (
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
                      ) : tableView.speed === 'menaces' ? (
                        <div className="filter-content-placeholder">Non implémenté</div>
                      ) : (<>
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
                      </>)}
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

                      <div className="speed-tiers-container">
                      <div className="speed-tiers-toolbar">
                        <div className="off-toolbar-group">
                          <span className="off-toolbar-label">Terrain</span>
                          <button
                            type="button"
                            className={`off-toolbar-btn${offGravity ? ' active' : ''}`}
                            onClick={() => setOffGravity(v => !v)}
                            title="Gravité (×1.67 précision, immunités Sol annulées)"
                          >
                            Gravité
                          </button>
                          <div className="off-toolbar-popover-wrap" ref={weatherPopoverRef}>
                            <button
                              type="button"
                              className={`off-toolbar-btn${offWeather ? ` ${offWeather}` : ''}`}
                              onClick={() => setWeatherModalOpen(v => !v)}
                              title="Météo"
                            >
                              {!offWeather && <span className="picker-neutre-icon" aria-hidden="true">☁</span>}
                              {WEATHER_OPTIONS.find(o => o.val === offWeather)?.label ?? 'Neutre'}
                            </button>
                            {weatherModalOpen && (
                              <div className="off-toolbar-popover">
                                <div className="weather-picker-grid">
                                  {WEATHER_OPTIONS.map(o => (
                                    <button
                                      key={o.val}
                                      type="button"
                                      className={`weather-picker-btn${o.val ? ` ${o.val}` : ''}${offWeather === o.val ? ' selected' : ''}`}
                                      onClick={() => {
                                        setOffWeather(o.val as Weather)
                                        setWeatherModalOpen(false)
                                      }}
                                    >
                                      {o.val === '' && <span className="picker-neutre-icon" aria-hidden="true">☁</span>}
                                      {o.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="off-toolbar-popover-wrap" ref={terrainPopoverRef}>
                            <button
                              type="button"
                              className={`off-toolbar-btn${offTerrain ? ` ${offTerrain}` : ''}`}
                              onClick={() => setTerrainModalOpen(v => !v)}
                              title="Terrain"
                            >
                              {!offTerrain && <span className="picker-neutre-icon" aria-hidden="true">≋</span>}
                              {TERRAIN_OPTIONS.find(o => o.val === offTerrain)?.label ?? 'Neutre'}
                            </button>
                            {terrainModalOpen && (
                              <div className="off-toolbar-popover">
                                <div className="weather-picker-grid">
                                  {TERRAIN_OPTIONS.map(o => (
                                    <button
                                      key={o.val}
                                      type="button"
                                      className={`weather-picker-btn${o.val ? ` ${o.val}` : ''}${offTerrain === o.val ? ' selected' : ''}`}
                                      onClick={() => {
                                        setOffTerrain(o.val as Terrain)
                                        setTerrainModalOpen(false)
                                      }}
                                    >
                                      {o.val === '' && <span className="picker-neutre-icon" aria-hidden="true">≋</span>}
                                      {o.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="off-toolbar-group">
                          <span className="off-toolbar-label">Joueur</span>
                          <button
                            type="button"
                            className={`off-toolbar-btn${state.helpingHand ? ' active' : ''}`}
                            onClick={() => dispatch({ type: 'SET_HELPING_HAND', value: !state.helpingHand })}
                            title="Coup d'Main (×1.5 dégâts en doubles)"
                          >
                            Coup d'Main
                          </button>
                          {isOffAbility && (
                            <button
                              type="button"
                              className={`off-toolbar-btn${offAbilityBoostActive ? ' active' : ''}`}
                              onClick={() => dispatch({ type: 'TOGGLE_SLOT_OFF_ABILITY', slot: activeSlotIdx })}
                              title={`${translateAbility(currentAbilityName)} (boost offensif conditionnel)`}
                            >
                              {translateAbility(currentAbilityName)}
                            </button>
                          )}
                        </div>
                        <div className="off-toolbar-group">
                          <span className="off-toolbar-label">Adversaire</span>
                          <button
                            type="button"
                            className={`off-toolbar-btn${state.auroraVeil ? ' active' : ''}`}
                            onClick={() => dispatch({ type: 'SET_AURORA_VEIL', value: !state.auroraVeil })}
                            title="Écran (réduit dégâts physiques et spéciaux)"
                          >
                            Écran
                          </button>
                        </div>
                      </div>

                      <div className="filter-sub-tabs table-view-selector">
                        <button className={`filter-sub-tab${tableView.off === 'general' ? ' active' : ''}`} onClick={() => setTableView(v => ({ ...v, off: 'general' }))}>Général</button>
                        <button className={`filter-sub-tab${tableView.off === 'filtres' ? ' active' : ''}`} onClick={() => setTableView(v => ({ ...v, off: 'filtres' }))}>Filtres</button>
                        <button className={`filter-sub-tab${tableView.off === 'menaces' ? ' active' : ''}`} onClick={() => setTableView(v => ({ ...v, off: 'menaces' }))}>Menaces</button>
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
                      {tableView.off === 'filtres' ? (
                        activeSlot.offFilters && activeSlot.offFilters.length > 0 ? (
                          <div className="active-filters-list">
                            {[...activeSlot.offFilters].sort((a, b) => {
                              const aMin = a.minPct ?? Infinity
                              const bMin = b.minPct ?? Infinity
                              return aMin - bMin
                            }).map(f => {
                              const tier = f.tier
                              const minPct = f.minPct
                              const maxPct = f.maxPct
                              const rep = (f.repartition ?? 'none') as Repartition
                              return (
                                <div key={f.id} className={`active-filter-item${tier ? ` tier-${tier}` : ''}`}>
                                  <div className="filter-item-info">
                                    <span className="filter-item-name">{f.pokemonName}</span>
                                    {rep !== 'none' && (
                                      <span className="filter-item-repart">{REPARTITION_TAGS[rep]}</span>
                                    )}
                                    {minPct != null && maxPct != null && (
                                      <span className="filter-item-pct">{minPct.toFixed(1)}–{maxPct.toFixed(1)}%</span>
                                    )}
                                  </div>
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
                      ) : tableView.off === 'menaces' ? (
                        <div className="filter-content-placeholder">Non implémenté</div>
                      ) : (
                      <div className="off-damage-container">
                        <div className="off-damage-header">
                          <div className="off-col-name name-sort-cell" ref={offNameSortPopoverRef}>
                            <button
                              type="button"
                              className="name-sort-trigger sortable"
                              onClick={() => setOffNameSortModalOpen(o => !o)}
                            >
                              Pokémon {offSort.key === 'name'
                                ? (offSort.dir === 'asc' ? 'A-Z' : 'Z-A')
                                : offSort.key === 'usage'
                                  ? (offSort.dir === 'asc' ? '% ↑' : '% ↓')
                                  : ''}
                            </button>
                            {offNameSortModalOpen && (
                              <div className="name-sort-popover">
                                <button type="button" className={`name-sort-option${offSort.key === 'name' && offSort.dir === 'asc' ? ' active' : ''}`} onClick={() => { setOffSort({ key: 'name', dir: 'asc' }); setOffNameSortModalOpen(false) }}>A-Z</button>
                                <button type="button" className={`name-sort-option${offSort.key === 'name' && offSort.dir === 'desc' ? ' active' : ''}`} onClick={() => { setOffSort({ key: 'name', dir: 'desc' }); setOffNameSortModalOpen(false) }}>Z-A</button>
                                <button type="button" className={`name-sort-option${offSort.key === 'usage' && offSort.dir === 'desc' ? ' active' : ''}`} onClick={() => { setOffSort({ key: 'usage', dir: 'desc' }); setOffNameSortModalOpen(false) }}>Usage ↓</button>
                                <button type="button" className={`name-sort-option${offSort.key === 'usage' && offSort.dir === 'asc' ? ' active' : ''}`} onClick={() => { setOffSort({ key: 'usage', dir: 'asc' }); setOffNameSortModalOpen(false) }}>Usage ↑</button>
                              </div>
                            )}
                          </div>
                          <div className="off-col-talent">Talent</div>
                          <div className="off-col-repart name-sort-cell" ref={offRepartPopoverRef}>
                            <button
                              type="button"
                              className="name-sort-trigger sortable"
                              onClick={() => setOffRepartModalOpen(o => !o)}
                            >
                              Répartition {activeSlot.offRepartMode === 'def' ? 'Déf.' : 'Comm.'}
                            </button>
                            {offRepartModalOpen && (
                              <div className="name-sort-popover">
                                <button type="button" className={`name-sort-option${(activeSlot.offRepartMode ?? 'common') === 'common' ? ' active' : ''}`} onClick={() => { dispatch({ type: 'SET_REPART_MODE', slot: activeSlotIdx, table: 'off', mode: 'common' }); setOffRepartModalOpen(false) }}>Most Common</button>
                                <button type="button" className={`name-sort-option${activeSlot.offRepartMode === 'def' ? ' active' : ''}`} onClick={() => { dispatch({ type: 'SET_REPART_MODE', slot: activeSlotIdx, table: 'off', mode: 'def' }); setOffRepartModalOpen(false) }}>Most Defensive</button>
                              </div>
                            )}
                          </div>
                          <div className="off-col-move name-sort-cell" ref={offMoveSortPopoverRef}>
                            <button
                              type="button"
                              className="name-sort-trigger sortable"
                              onClick={() => setOffMoveSortModalOpen(o => !o)}
                            >
                              Capacité {showOnlyBestOffensiveMove ? 'Meilleure' : 'Toutes'}
                            </button>
                            {offMoveSortModalOpen && (
                              <div className="name-sort-popover">
                                <button type="button" className={`name-sort-option${!showOnlyBestOffensiveMove ? ' active' : ''}`} onClick={() => { setShowOnlyBestOffensiveMove(false); setOffMoveSortModalOpen(false) }}>Toutes</button>
                                <button type="button" className={`name-sort-option${showOnlyBestOffensiveMove ? ' active' : ''}`} onClick={() => { setShowOnlyBestOffensiveMove(true); setOffMoveSortModalOpen(false) }}>Meilleure</button>
                              </div>
                            )}
                          </div>
                          <div className="off-col-dmg-val name-sort-cell" ref={offDmgSortPopoverRef}>
                            <button
                              type="button"
                              className="name-sort-trigger sortable"
                              onClick={() => setOffDmgSortModalOpen(o => !o)}
                            >
                              Dégâts (%) {offSort.key === 'damage' ? (offSort.dir === 'asc' ? '↑' : '↓') : ''}
                            </button>
                            {offDmgSortModalOpen && (
                              <div className="name-sort-popover">
                                <button type="button" className={`name-sort-option${offSort.key === 'damage' && offSort.dir === 'desc' ? ' active' : ''}`} onClick={() => { setOffSort({ key: 'damage', dir: 'desc' }); setOffDmgSortModalOpen(false) }}>Dégâts ↓</button>
                                <button type="button" className={`name-sort-option${offSort.key === 'damage' && offSort.dir === 'asc' ? ' active' : ''}`} onClick={() => { setOffSort({ key: 'damage', dir: 'asc' }); setOffDmgSortModalOpen(false) }}>Dégâts ↑</button>
                              </div>
                            )}
                          </div>
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
                              const rawSlots = [0, 1, 2, 3]
                                .map(i => {
                                  const m = activeSlot.moves[i]
                                  const mr = (row.moveResults as any[])[i] ?? null
                                  if (!m || !mr) return null
                                  return { m, mr, idx: i }
                                })
                                .filter((s): s is { m: string, mr: any, idx: number } => s !== null)
                                .sort((a, b) => (b.mr.calc?.maxPct ?? 0) - (a.mr.calc?.maxPct ?? 0))

                              const slots = showOnlyBestOffensiveMove ? rawSlots.slice(0, 1) : rawSlots

                              const alreadyAdded = activeSlot.offFilters?.some(f => f.pokemonName === nom) ?? false
                              
                              return (
                                <div key={name} className="off-damage-row">
                                  <div className="off-col-name">
                                    <span>{nom}</span>
                                    {percent != null && <span className="off-col-name-pct">{Math.floor(percent)}%</span>}
                                  </div>
                                  <div className="off-col-talent">
                                    {(() => {
                                      const ta = offTopAbilities.get(name)
                                      if (!ta) return '—'
                                      const label = translateAbility(ta.name)
                                      return ta.percent != null && ta.percent > 0
                                        ? `${label} ${Math.floor(ta.percent)}%`
                                        : label
                                    })()}
                                  </div>
                                  <div className="off-col-repart">
                                    {(() => {
                                      const mode = activeSlot.offRepartMode ?? 'common'
                                      const spreads = offTopSpreads.get(name)
                                      if (!spreads || spreads.length === 0) return '—'
                                      if (mode === 'common') return formatSpreadCompact(pickCommonSpread(spreads), REPART_OFF_TABLE_KEYS)
                                      const sums = categorySums(effectiveName, name, activeSlot.moves)
                                      const stat: 'df' | 'sd' = sums.phys >= sums.spec ? 'df' : 'sd'
                                      return formatSpreadCompact(pickMaxStatSpread(spreads, stat), REPART_OFF_TABLE_KEYS)
                                    })()}
                                  </div>
                                  <div className="off-col-moves-list">
                                    {slots.length === 0 ? <div className="off-col-move">—</div> : slots.map((s, i) => (
                                      <div key={i} className="off-col-move" style={{ color: getMoveMeta(s.m)?.type ? `var(--type-${getMoveMeta(s.m)!.type.toLowerCase()})` : undefined }}>
                                        {getMoveNom(s.m)}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="off-col-dmg-list">
                                    {slots.length === 0 ? <div className="off-col-dmg-val">—</div> : slots.map((s, i) => {
                                      const calc = s.mr.calc
                                      const tierCls = !calc ? '' :
                                        calc.minPct >= 100 ? ' tier-ohko' :
                                        calc.maxPct >= 100 ? ' tier-ko-poss' :
                                        calc.minPct >= 50  ? ' tier-ko-mid' :
                                        calc.minPct >= 25  ? ' tier-ko' :
                                        ' tier-ko-low'

                                      return (
                                        <div key={i} className={`off-col-dmg-val ${tierCls}`}>
                                          {calc ? (
                                            <span className="off-dmg-pct">{calc.minPct.toFixed(1)}–{calc.maxPct.toFixed(1)}%</span>
                                          ) : s.mr.immune ? (
                                            <span className="off-dmg-na">Immunisé</span>
                                          ) : (
                                            <span className="off-dmg-na">—</span>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                  <div className="off-col-action">
                                    <button
                                      type="button"
                                      className={`tier-add-btn${alreadyAdded ? ' added' : ''}`}
                                      disabled={alreadyAdded}
                                      onClick={() => {
                                        let bestTier: import('../types').OffTier | undefined
                                        let bestMin: number | undefined
                                        let bestMax: number | undefined
                                        let bestScore = -Infinity
                                        for (const slot of slots) {
                                          const c = slot.mr.calc
                                          if (!c) continue
                                          const t: import('../types').OffTier =
                                            c.minPct >= 100 ? 'ohko' :
                                            c.maxPct >= 100 ? 'ko-poss' :
                                            c.minPct >= 50  ? 'ko-mid' :
                                            c.minPct >= 25  ? 'ko' :
                                            'ko-low'
                                          const rank = t === 'ohko' ? 4 : t === 'ko-poss' ? 3 : t === 'ko-mid' ? 2 : t === 'ko' ? 1 : 0
                                          const score = rank * 1000 + (c.minPct ?? 0)
                                          if (score > bestScore) {
                                            bestScore = score; bestTier = t; bestMin = c.minPct; bestMax = c.maxPct
                                          }
                                        }
                                        dispatch({
                                          type: 'ADD_OFF_FILTER',
                                          slot: activeSlotIdx,
                                          filter: {
                                            id: `${name}-${Date.now()}`,
                                            pokemonName: nom,
                                            tier: bestTier,
                                            minPct: bestMin,
                                            maxPct: bestMax,
                                          }
                                        })
                                      }}
                                    >
                                      {alreadyAdded ? 'Ajouté' : 'Ajouter'}
                                    </button>
                                  </div>
                                </div>
                              )
                            })
                          })()}
                        </div>
                      </div>
                      )}
                      </div>
                    </div>
                  );

                  const defTabContent = (
                    <div className="off-ev-config">
                      <div className="off-ev-header">
                        <div className="off-ev-sliders">
                          {(['hp', 'df', 'sd'] as const).map(s => renderDefSlider(s))}
                        </div>
                        <div className="speed-ev-remaining" title="EVs restants (66 max)">
                          <span className="speed-ev-remaining-text">EVs restant</span>
                          <span className="speed-ev-remaining-value">{remainingSP}</span>
                          <span className="speed-ev-remaining-label">/66</span>
                        </div>
                      </div>

                      <div className="speed-tiers-container">
                      <div className="speed-tiers-toolbar">
                        <div className="off-toolbar-group">
                          <span className="off-toolbar-label">Terrain</span>
                          <button
                            type="button"
                            className={`off-toolbar-btn${defGravity ? ' active' : ''}`}
                            onClick={() => setDefGravity(v => !v)}
                            title="Gravité (×1.67 précision, immunités Sol annulées)"
                          >
                            Gravité
                          </button>
                          <div className="off-toolbar-popover-wrap" ref={defWeatherPopoverRef}>
                            <button
                              type="button"
                              className={`off-toolbar-btn${defWeather ? ` ${defWeather}` : ''}`}
                              onClick={() => setDefWeatherModalOpen(v => !v)}
                              title="Météo"
                            >
                              {!defWeather && <span className="picker-neutre-icon" aria-hidden="true">☁</span>}
                              {WEATHER_OPTIONS.find(o => o.val === defWeather)?.label ?? 'Neutre'}
                            </button>
                            {defWeatherModalOpen && (
                              <div className="off-toolbar-popover">
                                <div className="weather-picker-grid">
                                  {WEATHER_OPTIONS.map(o => (
                                    <button
                                      key={o.val}
                                      type="button"
                                      className={`weather-picker-btn${o.val ? ` ${o.val}` : ''}${defWeather === o.val ? ' selected' : ''}`}
                                      onClick={() => {
                                        setDefWeather(o.val as Weather)
                                        setDefWeatherModalOpen(false)
                                      }}
                                    >
                                      {o.val === '' && <span className="picker-neutre-icon" aria-hidden="true">☁</span>}
                                      {o.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="off-toolbar-popover-wrap" ref={defTerrainPopoverRef}>
                            <button
                              type="button"
                              className={`off-toolbar-btn${defTerrain ? ` ${defTerrain}` : ''}`}
                              onClick={() => setDefTerrainModalOpen(v => !v)}
                              title="Terrain"
                            >
                              {!defTerrain && <span className="picker-neutre-icon" aria-hidden="true">≋</span>}
                              {TERRAIN_OPTIONS.find(o => o.val === defTerrain)?.label ?? 'Neutre'}
                            </button>
                            {defTerrainModalOpen && (
                              <div className="off-toolbar-popover">
                                <div className="weather-picker-grid">
                                  {TERRAIN_OPTIONS.map(o => (
                                    <button
                                      key={o.val}
                                      type="button"
                                      className={`weather-picker-btn${o.val ? ` ${o.val}` : ''}${defTerrain === o.val ? ' selected' : ''}`}
                                      onClick={() => {
                                        setDefTerrain(o.val as Terrain)
                                        setDefTerrainModalOpen(false)
                                      }}
                                    >
                                      {o.val === '' && <span className="picker-neutre-icon" aria-hidden="true">≋</span>}
                                      {o.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="off-toolbar-group">
                          <span className="off-toolbar-label">Joueur</span>
                          <button
                            type="button"
                            className={`off-toolbar-btn${state.auroraVeil ? ' active' : ''}`}
                            onClick={() => dispatch({ type: 'SET_AURORA_VEIL', value: !state.auroraVeil })}
                            title="Écran (réduit dégâts physiques et spéciaux)"
                          >
                            Écran
                          </button>
                        </div>
                        <div className="off-toolbar-group">
                          <span className="off-toolbar-label">Adversaire</span>
                          <button
                            type="button"
                            className={`off-toolbar-btn${state.advHelpingHand ? ' active' : ''}`}
                            onClick={() => dispatch({ type: 'SET_ADV_HELPING_HAND', value: !state.advHelpingHand })}
                            title="Coup d'Main adverse (×1.5 dégâts en doubles)"
                          >
                            Coup d'Main
                          </button>
                        </div>
                      </div>

                      <div className="filter-sub-tabs table-view-selector">
                        <button className={`filter-sub-tab${tableView.def === 'general' ? ' active' : ''}`} onClick={() => setTableView(v => ({ ...v, def: 'general' }))}>Général</button>
                        <button className={`filter-sub-tab${tableView.def === 'filtres' ? ' active' : ''}`} onClick={() => setTableView(v => ({ ...v, def: 'filtres' }))}>Filtres</button>
                        <button className={`filter-sub-tab${tableView.def === 'menaces' ? ' active' : ''}`} onClick={() => setTableView(v => ({ ...v, def: 'menaces' }))}>Menaces</button>
                      </div>
                      <div className="speed-tiers-search">
                        <input
                          className="tier-search-input"
                          type="text"
                          placeholder="Rechercher un Pokémon..."
                          value={defSearch}
                          onChange={e => setDefSearch(e.target.value)}
                        />
                      </div>

                      {tableView.def === 'filtres' ? (
                        activeSlot.defFilters && activeSlot.defFilters.length > 0 ? (
                          <div className="active-filters-list">
                            {[...activeSlot.defFilters].sort((a, b) => {
                              const aMin = a.minPct ?? Infinity
                              const bMin = b.minPct ?? Infinity
                              return aMin - bMin
                            }).map(f => {
                              const tier = f.tier
                              const minPct = f.minPct
                              const maxPct = f.maxPct
                              return (
                                <div key={f.id} className={`active-filter-item${tier ? ` tier-${tier}` : ''}`}>
                                  <div className="filter-item-info">
                                    <span className="filter-item-name">{f.pokemonName}</span>
                                    {minPct != null && maxPct != null && (
                                      <span className="filter-item-pct">{minPct.toFixed(1)}–{maxPct.toFixed(1)}%</span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    className="filter-item-remove"
                                    onClick={() => dispatch({ type: 'REMOVE_DEF_FILTER', slot: activeSlotIdx, id: f.id })}
                                    aria-label="Retirer"
                                  >✕</button>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="filter-content-placeholder">Aucun filtre défensif</div>
                        )
                      ) : tableView.def === 'menaces' ? (
                        <div className="filter-content-placeholder">Non implémenté</div>
                      ) : (
                      <div className="off-damage-container is-def">
                        <div className="off-damage-header">
                          <div className="off-col-name name-sort-cell" ref={defNameSortPopoverRef}>
                            <button
                              type="button"
                              className="name-sort-trigger sortable"
                              onClick={() => setDefNameSortModalOpen(o => !o)}
                            >
                              Pokémon {defSort.key === 'name'
                                ? (defSort.dir === 'asc' ? 'A-Z' : 'Z-A')
                                : defSort.key === 'usage'
                                  ? (defSort.dir === 'asc' ? '% ↑' : '% ↓')
                                  : ''}
                            </button>
                            {defNameSortModalOpen && (
                              <div className="name-sort-popover">
                                <button type="button" className={`name-sort-option${defSort.key === 'name' && defSort.dir === 'asc' ? ' active' : ''}`} onClick={() => { setDefSort({ key: 'name', dir: 'asc' }); setDefNameSortModalOpen(false) }}>A-Z</button>
                                <button type="button" className={`name-sort-option${defSort.key === 'name' && defSort.dir === 'desc' ? ' active' : ''}`} onClick={() => { setDefSort({ key: 'name', dir: 'desc' }); setDefNameSortModalOpen(false) }}>Z-A</button>
                                <button type="button" className={`name-sort-option${defSort.key === 'usage' && defSort.dir === 'desc' ? ' active' : ''}`} onClick={() => { setDefSort({ key: 'usage', dir: 'desc' }); setDefNameSortModalOpen(false) }}>Usage ↓</button>
                                <button type="button" className={`name-sort-option${defSort.key === 'usage' && defSort.dir === 'asc' ? ' active' : ''}`} onClick={() => { setDefSort({ key: 'usage', dir: 'asc' }); setDefNameSortModalOpen(false) }}>Usage ↑</button>
                              </div>
                            )}
                          </div>
                          <div className="off-col-talent">Talent</div>
                          <div className="off-col-repart name-sort-cell" ref={defRepartPopoverRef}>
                            <button
                              type="button"
                              className="name-sort-trigger sortable"
                              onClick={() => setDefRepartModalOpen(o => !o)}
                            >
                              Répartition {activeSlot.defRepartMode === 'off' ? 'Off.' : 'Comm.'}
                            </button>
                            {defRepartModalOpen && (
                              <div className="name-sort-popover">
                                <button type="button" className={`name-sort-option${(activeSlot.defRepartMode ?? 'common') === 'common' ? ' active' : ''}`} onClick={() => { dispatch({ type: 'SET_REPART_MODE', slot: activeSlotIdx, table: 'def', mode: 'common' }); setDefRepartModalOpen(false) }}>Most Common</button>
                                <button type="button" className={`name-sort-option${activeSlot.defRepartMode === 'off' ? ' active' : ''}`} onClick={() => { dispatch({ type: 'SET_REPART_MODE', slot: activeSlotIdx, table: 'def', mode: 'off' }); setDefRepartModalOpen(false) }}>Most Offensive</button>
                              </div>
                            )}
                          </div>
                          <div className="off-col-move name-sort-cell" ref={defMoveSortPopoverRef}>
                            <button
                              type="button"
                              className="name-sort-trigger sortable"
                              onClick={() => setDefMoveSortModalOpen(o => !o)}
                            >
                              Capacité {showOnlyWorstDefensiveMove ? 'Pire' : 'Toutes'}
                            </button>
                            {defMoveSortModalOpen && (
                              <div className="name-sort-popover">
                                <button type="button" className={`name-sort-option${!showOnlyWorstDefensiveMove ? ' active' : ''}`} onClick={() => { setShowOnlyWorstDefensiveMove(false); setDefMoveSortModalOpen(false) }}>Toutes</button>
                                <button type="button" className={`name-sort-option${showOnlyWorstDefensiveMove ? ' active' : ''}`} onClick={() => { setShowOnlyWorstDefensiveMove(true); setDefMoveSortModalOpen(false) }}>Pire</button>
                              </div>
                            )}
                          </div>
                          <div className="off-col-dmg-val name-sort-cell" ref={defDmgSortPopoverRef}>
                            <button
                              type="button"
                              className="name-sort-trigger sortable"
                              onClick={() => setDefDmgSortModalOpen(o => !o)}
                            >
                              Dégâts (%) {defSort.key === 'damage' ? (defSort.dir === 'asc' ? '↑' : '↓') : ''}
                            </button>
                            {defDmgSortModalOpen && (
                              <div className="name-sort-popover">
                                <button type="button" className={`name-sort-option${defSort.key === 'damage' && defSort.dir === 'desc' ? ' active' : ''}`} onClick={() => { setDefSort({ key: 'damage', dir: 'desc' }); setDefDmgSortModalOpen(false) }}>Dégâts ↓</button>
                                <button type="button" className={`name-sort-option${defSort.key === 'damage' && defSort.dir === 'asc' ? ' active' : ''}`} onClick={() => { setDefSort({ key: 'damage', dir: 'asc' }); setDefDmgSortModalOpen(false) }}>Dégâts ↑</button>
                              </div>
                            )}
                          </div>
                          <div className="off-col-action">Filtre</div>
                        </div>
                        <div className="off-damage-list">
                          {loadingSpeedTiers ? (
                            <div className="tiers-loading">Chargement...</div>
                          ) : defDamageRows.length === 0 ? (
                            <div className="tiers-loading">Aucune donnée</div>
                          ) : (() => {
                            const q = defSearch.trim().toLowerCase()
                            const filtered = q
                              ? defDamageRows.filter(r => r.nom.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
                              : defDamageRows
                            if (filtered.length === 0) return <div className="tiers-loading">Aucun résultat</div>

                            return filtered.map(({ name, nom, percent, row }) => {
                              const rawSlots = [0, 1, 2, 3]
                                .map(i => {
                                  const mv = (row.moveResults as any[])[i] ?? null
                                  if (!mv) return null
                                  return { mr: mv, idx: i }
                                })
                                .filter((s): s is { mr: any, idx: number } => s !== null)
                                .sort((a, b) => (b.mr.calc?.maxPct ?? 0) - (a.mr.calc?.maxPct ?? 0))

                              const slots = showOnlyWorstDefensiveMove ? rawSlots.slice(0, 1) : rawSlots

                              const alreadyAdded = activeSlot.defFilters?.some(f => f.pokemonName === nom) ?? false

                              return (
                                <div key={name} className="off-damage-row">
                                  <div className="off-col-name">
                                    <span>{nom}</span>
                                    {percent != null && <span className="off-col-name-pct">{Math.floor(percent)}%</span>}
                                  </div>
                                  <div className="off-col-talent">
                                    {(() => {
                                      const ta = defTopAbilities.get(name)
                                      if (!ta) return '—'
                                      const label = translateAbility(ta.name)
                                      return ta.percent != null && ta.percent > 0
                                        ? `${label} ${Math.floor(ta.percent)}%`
                                        : label
                                    })()}
                                  </div>
                                  <div className="off-col-repart">
                                    {(() => {
                                      const mode = activeSlot.defRepartMode ?? 'common'
                                      const spreads = defTopSpreads.get(name)
                                      if (!spreads || spreads.length === 0) return '—'
                                      if (mode === 'common') return formatSpreadCompact(pickCommonSpread(spreads), REPART_DEF_TABLE_KEYS)
                                      const oppMoves = (defTopMoves.get(name) ?? []).map(tm => tm.name)
                                      const sums = categorySums(name, effectiveName, oppMoves)
                                      const stat: 'at' | 'sa' = sums.phys >= sums.spec ? 'at' : 'sa'
                                      return formatSpreadCompact(pickMaxStatSpread(spreads, stat), REPART_DEF_TABLE_KEYS)
                                    })()}
                                  </div>
                                  <div className="off-col-moves-list">
                                    {slots.length === 0 ? <div className="off-col-move">—</div> : slots.map((s, i) => (
                                      <div key={i} className="off-col-move" style={{ color: getMoveMeta(s.mr.move)?.type ? `var(--type-${getMoveMeta(s.mr.move)!.type.toLowerCase()})` : undefined }}>
                                        {getMoveNom(s.mr.move)}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="off-col-dmg-list">
                                    {slots.length === 0 ? <div className="off-col-dmg-val">—</div> : slots.map((s, i) => {
                                      const calc = s.mr.calc
                                      const tierCls = !calc ? '' :
                                        calc.minPct >= 100 ? ' tier-ohko' :
                                        calc.maxPct >= 100 ? ' tier-ko-poss' :
                                        calc.minPct >= 50  ? ' tier-ko-mid' :
                                        calc.minPct >= 25  ? ' tier-ko' :
                                        ' tier-ko-low'

                                      return (
                                        <div key={i} className={`off-col-dmg-val ${tierCls}`}>
                                          {calc ? (
                                            <span className="off-dmg-pct">{calc.minPct.toFixed(1)}–{calc.maxPct.toFixed(1)}%</span>
                                          ) : s.mr.immune ? (
                                            <span className="off-dmg-na">Immunisé</span>
                                          ) : (
                                            <span className="off-dmg-na">—</span>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                  <div className="off-col-action">
                                    <button
                                      type="button"
                                      className={`tier-add-btn${alreadyAdded ? ' added' : ''}`}
                                      disabled={alreadyAdded}
                                      onClick={() => {
                                        let bestTier: import('../types').OffTier | undefined
                                        let bestMin: number | undefined
                                        let bestMax: number | undefined
                                        let bestScore = -Infinity
                                        for (const slot of slots) {
                                          const c = slot.mr.calc
                                          if (!c) continue
                                          const t: import('../types').OffTier =
                                            c.minPct >= 100 ? 'ohko' :
                                            c.maxPct >= 100 ? 'ko-poss' :
                                            c.minPct >= 50  ? 'ko-mid' :
                                            c.minPct >= 25  ? 'ko' :
                                            'ko-low'
                                          const rank = t === 'ohko' ? 4 : t === 'ko-poss' ? 3 : t === 'ko-mid' ? 2 : t === 'ko' ? 1 : 0
                                          const score = rank * 1000 + (c.minPct ?? 0)
                                          if (score > bestScore) {
                                            bestScore = score; bestTier = t; bestMin = c.minPct; bestMax = c.maxPct
                                          }
                                        }
                                        dispatch({
                                          type: 'ADD_DEF_FILTER',
                                          slot: activeSlotIdx,
                                          filter: {
                                            id: `${name}-${Date.now()}`,
                                            pokemonName: nom,
                                            tier: bestTier,
                                            minPct: bestMin,
                                            maxPct: bestMax,
                                          }
                                        })
                                      }}
                                    >
                                      {alreadyAdded ? 'Ajouté' : 'Ajouter'}
                                    </button>
                                  </div>
                                </div>
                              )
                            })
                          })()}
                        </div>
                      </div>
                      )}
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
                                const disabled = !isAdded && !hasEmpty
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
                      {activeTab === 'evs-def' && defTabContent}
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
                    {filterTabs.def === 'custom' && (
                      activeSlot.defFilters && activeSlot.defFilters.length > 0 ? (
                        <div className="active-filters-list">
                          {[...activeSlot.defFilters].sort((a, b) => {
                            const aMin = a.minPct ?? Infinity
                            const bMin = b.minPct ?? Infinity
                            return aMin - bMin
                          }).map(f => {
                            const tier = f.tier
                            const minPct = f.minPct
                            const maxPct = f.maxPct
                            return (
                              <div key={f.id} className={`active-filter-item${tier ? ` tier-${tier}` : ''}`}>
                                <div className="filter-item-info">
                                  <span className="filter-item-name">{f.pokemonName}</span>
                                  {minPct != null && maxPct != null && (
                                    <span className="filter-item-pct">{minPct.toFixed(1)}–{maxPct.toFixed(1)}%</span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  className="filter-item-remove"
                                  onClick={() => dispatch({ type: 'REMOVE_DEF_FILTER', slot: activeSlotIdx, id: f.id })}
                                  aria-label="Retirer"
                                >✕</button>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="filter-content-placeholder">Aucun filtre défensif</div>
                      )
                    )}
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
                          {[...activeSlot.offFilters].sort((a, b) => {
                            const aMin = a.minPct ?? Infinity
                            const bMin = b.minPct ?? Infinity
                            return aMin - bMin
                          }).map(f => {
                            const tier = f.tier
                            const minPct = f.minPct
                            const maxPct = f.maxPct
                            const rep = (f.repartition ?? 'none') as Repartition
                            return (
                            <div key={f.id} className={`active-filter-item${tier ? ` tier-${tier}` : ''}`}>
                              <div className="filter-item-info">
                                <span className="filter-item-name">{f.pokemonName}</span>
                                {rep !== 'none' && (
                                  <span className="filter-item-repart">{REPARTITION_TAGS[rep]}</span>
                                )}
                                {minPct != null && maxPct != null && (
                                  <span className="filter-item-pct">{minPct.toFixed(1)}–{maxPct.toFixed(1)}%</span>
                                )}
                              </div>
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
          if (confirmNatSwap.fallbackEv !== null) handleUpdateSP('sp', confirmNatSwap.fallbackEv)
          setConfirmNatSwap(null)
        }}>
          <div className="auto-modal" onClick={e => e.stopPropagation()}>
            <div className="auto-modal-header">
              <span className="auto-modal-icon">⚠</span>
              <h3>{confirmNatSwap.mode === 'savings' ? 'Modification de nature suggérée' : 'Modification de nature requise'}</h3>
            </div>
            <div className="auto-modal-body">
              <p className="auto-modal-text">
                {confirmNatSwap.mode === 'savings' && confirmNatSwap.acceptReachesName
                  ? <>Nature actuelle suffit pour {confirmNatSwap.fallbackIsTie ? 'égaliser' : 'dépasser'} <strong>{confirmNatSwap.acceptReachesName}</strong> ({confirmNatSwap.fallbackReaches}). Nature modifiée {confirmNatSwap.acceptIsTie === confirmNatSwap.fallbackIsTie ? 'réduit les EV requis' : `permet de ${confirmNatSwap.acceptIsTie ? 'égaliser' : 'dépasser'}`} :</>
                  : confirmNatSwap.acceptReachesName
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
              {confirmNatSwap.impact && (
                <div className="auto-modal-impact">
                  <p className="auto-modal-note warn">
                    Pertes&nbsp;: <strong>{confirmNatSwap.impact.lossLabel}</strong> {confirmNatSwap.impact.oldVal} → {confirmNatSwap.impact.newVal} ({confirmNatSwap.impact.delta > 0 ? '+' : ''}{confirmNatSwap.impact.delta}).
                  </p>
                  {confirmNatSwap.impact.lostFilters.length > 0 && (
                    <p className="auto-modal-note warn">
                      {confirmNatSwap.impact.lostKind === 'ohko' ? 'OHKO perdu sur' : 'Vitesse perdue sur'}&nbsp;: <strong>{confirmNatSwap.impact.lostFilters.join(', ')}</strong>.
                    </p>
                  )}
                </div>
              )}
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
                  En refusant : aucune cible atteignable, EV inchangé.
                </p>
              )}
              {confirmNatSwap.acceptUnreached.length > 0 && (
                <p className="auto-modal-note warn">
                  Non dépassables même avec changement de nature : <strong>{confirmNatSwap.acceptUnreached.join(', ')}</strong>.
                </p>
              )}
              {confirmNatSwap.fallbackUnreached.length > 0 && (
                <p className="auto-modal-note warn">
                  Non dépassables en refusant : <strong>{confirmNatSwap.fallbackUnreached.join(', ')}</strong>.
                </p>
              )}
            </div>
            <div className="auto-modal-actions">
              <button className="auto-modal-btn cancel" onClick={() => {
                if (confirmNatSwap.fallbackEv !== null) handleUpdateSP('sp', confirmNatSwap.fallbackEv)
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
                Aucun OHKO possible avec les EVs restants ({noOhkoInfo.budget} dispo). Pas de modification.
              </p>
              <ul className="auto-modal-list">
                {noOhkoInfo.filterNames.map(name => {
                  const pct = noOhkoInfo.bestMinPct[name] ?? 0
                  return (
                    <li key={name}>
                      <strong>{name}</strong> — meilleur dégât atteint : {pct.toFixed(1)}%
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className="auto-modal-actions">
              <button className="auto-modal-btn confirm" onClick={() => setNoOhkoInfo(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {unreachableSpeed && (
        <div className="auto-modal-overlay" onClick={() => setUnreachableSpeed(null)}>
          <div className="auto-modal" onClick={e => e.stopPropagation()}>
            <div className="auto-modal-header">
              <span className="auto-modal-icon">⚠</span>
              <h3>Adversaires non dépassables</h3>
            </div>
            <div className="auto-modal-body">
              <p className="auto-modal-text">
                Impossible de dépasser ou égaliser <strong>{unreachableSpeed.names.join(', ')}</strong> avec 32 EV {state.trickRoom ? 'et nature −VIT' : 'et nature +VIT'}. Cible(s) ignorée(s).
              </p>
            </div>
            <div className="auto-modal-actions">
              <button className="auto-modal-btn confirm" onClick={() => setUnreachableSpeed(null)}>
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
              <h3>{confirmOffNatSwap.mode === 'savings' ? 'Modification de nature suggérée' : 'Modification de nature requise'}</h3>
            </div>
            <div className="auto-modal-body">
              <p className="auto-modal-text">
                {confirmOffNatSwap.mode === 'savings'
                  ? <>OHKO sur <strong>{confirmOffNatSwap.fallbackOhko.join(', ')}</strong> déjà possible avec la nature actuelle. Nature modifiée réduit les EV requis&nbsp;:</>
                  : (() => {
                      const fb = new Set(confirmOffNatSwap.fallbackOhko)
                      const newOhko = confirmOffNatSwap.acceptOhko.filter(n => !fb.has(n))
                      const list = newOhko.length > 0 ? newOhko : confirmOffNatSwap.acceptOhko
                      return <>Pour OHKO <strong>{list.join(', ')}</strong>, la nature doit être modifiée&nbsp;:</>
                    })()}
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
              {(() => {
                const acceptTotal = confirmOffNatSwap.acceptAllocAt + confirmOffNatSwap.acceptAllocSa
                const fallbackTotal = confirmOffNatSwap.fallbackAllocAt + confirmOffNatSwap.fallbackAllocSa
                return (
                  <p className="auto-modal-note">
                    EV total — Acceptant&nbsp;: <strong>{acceptTotal}</strong> · Refusant&nbsp;: <strong>{fallbackTotal}</strong>
                  </p>
                )
              })()}
              {confirmOffNatSwap.impact && (
                <div className="auto-modal-impact">
                  <p className="auto-modal-note warn">
                    Pertes&nbsp;: <strong>{confirmOffNatSwap.impact.lossLabel}</strong> {confirmOffNatSwap.impact.oldVal} → {confirmOffNatSwap.impact.newVal} ({confirmOffNatSwap.impact.delta > 0 ? '+' : ''}{confirmOffNatSwap.impact.delta}).
                  </p>
                  {confirmOffNatSwap.impact.lostFilters.length > 0 && (
                    <p className="auto-modal-note warn">
                      {confirmOffNatSwap.impact.lostKind === 'ohko' ? 'OHKO perdu sur' : 'Vitesse perdue sur'}&nbsp;: <strong>{confirmOffNatSwap.impact.lostFilters.join(', ')}</strong>.
                    </p>
                  )}
                </div>
              )}
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

      {/* Selection Modal */}
      {isModalOpen && (
        <div className="selection-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="selection-modal" onClick={e => e.stopPropagation()}>
            <div className="selection-modal-header">
              <h3>Choisir un Pokémon (Slot {modalSlotIdx + 1})</h3>
              <button className="selection-modal-close" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            <div className="selection-modal-search-box">
              <input
                type="text"
                autoFocus
                placeholder="Rechercher par nom..."
                value={modalSearch}
                onChange={e => setModalSearch(e.target.value)}
                className="selection-modal-input"
              />
            </div>
            <div className="selection-modal-grid">
              {filteredModalOptions.map(opt => (
                <button
                  key={opt.value}
                  className={`selection-modal-item ${opt.disabled ? 'disabled' : ''}`}
                  disabled={opt.disabled}
                  onClick={() => handleUpdatePoke(modalSlotIdx, opt.value)}
                >
                  <img src={opt.image} alt="" className="selection-modal-item-img" />
                  <span className="selection-modal-item-name">{opt.label}</span>
                  <div className="selection-modal-item-types">
                    {opt.types.map(t => (
                      <span key={t} className="type-badge" style={{ background: `var(--type-${t.toLowerCase()})` }}>
                        {TYPE_TRANSLATIONS[t] || t}
                      </span>
                    ))}
                  </div>
                  {opt.meta && <span className="selection-modal-item-usage">{opt.meta}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
