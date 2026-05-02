import type { TeamSlot, StatMap, BoostMap, AdvOverride, TableRow, Weather, Terrain, SortKey, DefaultSetSnapshot } from '../types'
import { POKE_DATA } from '../data/pokeData'
import { MOVE_DATA } from '../data/moveData'
import { getAbilitiesFor } from '../calc/teamHelpers'
import { MEGA_MAP } from '../data/megaMap'

const SP_TOTAL_MAX = 66

function clampSp(current: Record<string, number>, key: string, value: number): number {
  const others = Object.entries(current).filter(([k]) => k !== key).reduce((s, [, v]) => s + v, 0)
  return Math.min(value, Math.max(0, SP_TOTAL_MAX - others))
}

type CCMoveList = Array<{ move: { name: string } }>

function filterCCMoves(ccMoves: CCMoveList, megaForme: string): CCMoveList {
  if (megaForme === 'Mega Charizard X')
    return ccMoves.filter(m => { const cat = MOVE_DATA[m.move.name]?.category; return cat === 'Physical' || cat === 'Status' })
  if (megaForme === 'Mega Charizard Y')
    return ccMoves.filter(m => { const cat = MOVE_DATA[m.move.name]?.category; return cat === 'Special' || cat === 'Status' })
  return ccMoves
}

function applyTopMoves(slot: TeamSlot, megaForme: string): void {
  const ccMoves = slot.ccMoves as CCMoveList | null
  if (!ccMoves?.length) return
  const filtered = filterCCMoves(ccMoves, megaForme)
  const top4 = filtered.slice(0, 4).map(m => m.move.name)
  while (top4.length < 4) top4.push('')
  slot.moves = top4 as [string, string, string, string]
}

function makeSlot(id: number): TeamSlot {
  return {
    id,
    pokemon: '',
    megaForme: '',
    ability: '',
    item: '(No Item)',
    natPlus: '',
    natMinus: '',
    sps:    { hp:0, at:0, df:0, sa:0, sd:0, sp:0 },
    boosts: { at:0, df:0, sa:0, sd:0, sp:0 },
    moves:  ['','','',''],
    ccMoves: null,
    ccItems: null,
    ccAbilities: null,
    ccNature: null,
    ccSps: null,
    preMegaAbility: '',
    preMegaItem: '',
    useDefaultSet: false,
    preDefaultSet: null,
  }
}

export interface AppState {
  team: TeamSlot[]
  selectedSlot: number | null
  weather: Weather
  terrain: Terrain
  tailwind: boolean
  advStats: Record<string, Partial<AdvOverride>>
  tableData: TableRow[]
  sortKey: SortKey
  sortAsc: boolean
  filterSearch: string
  filterType: string
  filterKO: '' | 'ohko' | 'ko'
  showLowUsage: boolean
  favorites: string[]
  matchupAdvName: string | null
  slotNotes: Record<number, string>
  advMoves: Record<string, [string, string, string, string]>
  advItems: Record<string, string>
  advAutoSet: Record<string, boolean>
  advPreAutoSet: Record<string, AdvPreAutoSet>
}

interface AdvPreAutoSet {
  ability: string; item: string
  natPlus: string; natMinus: string
  sps: Record<string, number>
  moves: [string, string, string, string]
}

export const initialState: AppState = {
  team: Array.from({ length: 6 }, (_, i) => makeSlot(i)),
  selectedSlot: null,
  weather: '',
  terrain: '',
  tailwind: false,
  advStats: {},
  tableData: [],
  sortKey: 'usage',
  sortAsc: false,
  filterSearch: '',
  filterType: '',
  filterKO: '',
  showLowUsage: false,
  favorites: [],
  matchupAdvName: null,
  slotNotes: {},
  advMoves: {},
  advItems: {},
  advAutoSet: {},
  advPreAutoSet: {},
}

export type Action =
  | { type: 'SELECT_SLOT'; slot: number }
  | { type: 'UPDATE_SLOT_FIELD'; slot: number; field: string; value: string }
  | { type: 'UPDATE_MOVE'; slot: number; moveIdx: number; value: string }
  | { type: 'UPDATE_BOOST'; slot: number; stat: keyof BoostMap; value: number }
  | { type: 'UPDATE_SP'; slot: number; stat: keyof StatMap; value: number }
  | { type: 'SELECT_MEGA'; slot: number; megaForme: string; stone: string }
  | { type: 'SELECT_FORME'; slot: number; forme: string }
  | { type: 'SET_CC_DATA'; slot: number; pokemon: string; ccMoves: unknown[] | null; ccItems: unknown[] | null; ccAbilities: unknown[] | null; ccNature?: { natPlus: string; natMinus: string } | null; ccSps?: StatMap | null }
  | { type: 'TOGGLE_DEFAULT_SET'; slot: number }
  | { type: 'SET_WEATHER'; weather: Weather }
  | { type: 'SET_TERRAIN'; terrain: Terrain }
  | { type: 'SET_TAILWIND'; value: boolean }
  | { type: 'SET_ADV_STAT'; pokeName: string; statKey: 'sp_hp' | 'sp_df' | 'sp_sd' | 'sp_sp' | 'sp_at' | 'sp_sa'; value: number }
  | { type: 'SET_ADV_NATURE'; pokeName: string; field: 'natPlus' | 'natMinus'; value: string }
  | { type: 'SET_ADV_ABILITY'; pokeName: string; value: string }
  | { type: 'SET_TABLE_DATA'; tableData: TableRow[] }
  | { type: 'UPDATE_TABLE_ROW'; pokeName: string; row: Partial<TableRow> }
  | { type: 'SET_SORT'; key: SortKey; asc: boolean }
  | { type: 'SET_FILTER_SEARCH'; value: string }
  | { type: 'SET_FILTER_TYPE'; value: string }
  | { type: 'SET_FILTER_KO'; value: '' | 'ohko' | 'ko' }
  | { type: 'SET_SHOW_LOW_USAGE'; value: boolean }
  | { type: 'TOGGLE_FAVORITE'; pokeName: string }
  | { type: 'SET_MATCHUP_ADV'; pokeName: string | null }
  | { type: 'SET_SLOT_NOTES'; slot: number; notes: string }
  | { type: 'SET_ADV_MOVE'; pokeName: string; moveIdx: number; value: string }
  | { type: 'RESET_ADV'; pokeName: string; ability: string; moves: [string, string, string, string] }
  | { type: 'SET_ADV_ITEM'; pokeName: string; value: string }
  | { type: 'TOGGLE_ADV_AUTO'; pokeName: string; ccAbility: string; ccItem: string; ccNatPlus: string; ccNatMinus: string; ccSps: Record<string, number> | null; ccMoves: [string, string, string, string] }

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SELECT_SLOT':
      return { ...state, selectedSlot: action.slot }

    case 'UPDATE_SLOT_FIELD': {
      const team = [...state.team]
      const slot = { ...team[action.slot] }
      ;(slot as Record<string, unknown>)[action.field] = action.value

      if (action.field === 'pokemon') {
        const pd = POKE_DATA[action.value]
        const filteredAbs = getAbilitiesFor(action.value)
        slot.ability   = filteredAbs ? filteredAbs[0] : (pd ? (pd.ab as string) : '')
        slot.sps       = { hp:0, at:0, df:0, sa:0, sd:0, sp:0 }
        slot.boosts    = { at:0, df:0, sa:0, sd:0, sp:0 }
        slot.natPlus   = ''
        slot.natMinus  = ''
        slot.megaForme = ''
        slot.ccMoves        = null
        slot.ccItems        = null
        slot.ccAbilities    = null
        slot.ccNature       = null
        slot.ccSps          = null
        slot.preMegaAbility = ''
        slot.preMegaItem    = ''
        slot.useDefaultSet  = false
        slot.preDefaultSet  = null
        slot.moves     = ['','','','']
        slot.item      = '(No Item)'
      }
      if (action.field === 'natPlus'  && action.value && action.value === slot.natMinus) slot.natMinus = ''
      if (action.field === 'natMinus' && action.value && action.value === slot.natPlus)  slot.natPlus  = ''

      if (slot.useDefaultSet && ['ability','item','natPlus','natMinus'].includes(action.field)) {
        slot.useDefaultSet = false
        slot.preDefaultSet = null
      }

      if (action.field === 'item' && action.value && action.value !== '(No Item)') {
        for (let i = 0; i < team.length; i++) {
          if (i !== action.slot && team[i].item === action.value) {
            team[i] = { ...team[i], item: '(No Item)' }
          }
        }
      }

      team[action.slot] = slot
      return { ...state, team }
    }

    case 'UPDATE_MOVE': {
      const team = [...state.team]
      const slot = team[action.slot]
      const moves = [...slot.moves] as [string,string,string,string]
      moves[action.moveIdx] = action.value
      team[action.slot] = {
        ...slot, moves,
        ...(slot.useDefaultSet ? { useDefaultSet: false, preDefaultSet: null } : {}),
      }
      return { ...state, team }
    }

    case 'UPDATE_BOOST': {
      const team = [...state.team]
      team[action.slot] = {
        ...team[action.slot],
        boosts: { ...team[action.slot].boosts, [action.stat]: action.value }
      }
      return { ...state, team }
    }

    case 'UPDATE_SP': {
      const team = [...state.team]
      const slot = team[action.slot]
      const clamped = clampSp(slot.sps, action.stat, action.value)
      team[action.slot] = {
        ...slot,
        sps: { ...slot.sps, [action.stat]: clamped },
        ...(slot.useDefaultSet ? { useDefaultSet: false, preDefaultSet: null } : {}),
      }
      return { ...state, team }
    }

    case 'SELECT_MEGA': {
      const team = [...state.team]
      const slot = { ...team[action.slot] }
      slot.megaForme = action.megaForme

      if (action.megaForme && action.stone) {
        slot.preMegaAbility = slot.ability
        slot.preMegaItem    = slot.item
        slot.item = action.stone
        for (let i = 0; i < team.length; i++) {
          if (i !== action.slot && team[i].item === action.stone) {
            team[i] = { ...team[i], item: '(No Item)' }
          }
        }
        const megaAbilities = getAbilitiesFor(action.megaForme)
        const megaData = POKE_DATA[action.megaForme]
        slot.ability = megaAbilities ? megaAbilities[0] : (megaData ? (megaData.ab as string) : slot.ability)
        if (slot.useDefaultSet) applyTopMoves(slot, action.megaForme)
      } else {
        slot.ability = slot.preMegaAbility || slot.ability
        slot.item    = slot.preMegaItem    || slot.item
        slot.preMegaAbility = ''
        slot.preMegaItem    = ''

        if (slot.useDefaultSet) {
          const topAbility = (slot.ccAbilities as Array<{ ability: { name: string } }> | null)?.[0]?.ability?.name
          if (topAbility) slot.ability = topAbility
          const topItem = (slot.ccItems as Array<{ item: { name: string } }> | null)?.[0]?.item?.name
          if (topItem) {
            slot.item = topItem
            for (let i = 0; i < team.length; i++) {
              if (i !== action.slot && team[i].item === topItem) {
                team[i] = { ...team[i], item: '(No Item)' }
              }
            }
          }
        }
      }

      team[action.slot] = slot
      return { ...state, team }
    }

    case 'SELECT_FORME': {
      const team = [...state.team]
      team[action.slot] = { ...team[action.slot], megaForme: action.forme }
      return { ...state, team }
    }

    case 'SET_CC_DATA': {
      const team = [...state.team]
      if (team[action.slot].pokemon === action.pokemon) {
        const slot = { ...team[action.slot] }
        const wasFirstLoad = slot.ccAbilities === null
        slot.ccMoves     = action.ccMoves as string[] | null
        slot.ccItems     = action.ccItems as string[] | null
        slot.ccAbilities = action.ccAbilities as string[] | null
        slot.ccNature    = action.ccNature ?? null
        slot.ccSps       = action.ccSps ?? null

        if (wasFirstLoad && action.ccAbilities && action.ccAbilities.length > 0) {
          const defaultAbility = (getAbilitiesFor(action.pokemon) ?? [])[0] ?? ''
          if (slot.ability === defaultAbility || slot.ability === '') {
            const top = (action.ccAbilities[0] as { ability?: { name?: string } }).ability?.name
            if (top) slot.ability = top
          }
        }

        team[action.slot] = slot
      }
      return { ...state, team }
    }

    case 'SET_WEATHER':
      return { ...state, weather: action.weather }

    case 'SET_TERRAIN':
      return { ...state, terrain: action.terrain }

    case 'SET_TAILWIND':
      return { ...state, tailwind: action.value }

    case 'SET_ADV_STAT': {
      const prev = state.advStats[action.pokeName] || {}
      const currentAdvSps: Record<string, number> = {

        sp_hp: prev.sp_hp ?? 0, sp_at: prev.sp_at ?? 0, sp_df: prev.sp_df ?? 0,
        sp_sa: prev.sp_sa ?? 0, sp_sd: prev.sp_sd ?? 0, sp_sp: prev.sp_sp ?? 0,
      }
      const clamped = clampSp(currentAdvSps, action.statKey, action.value)
      return {
        ...state,
        advAutoSet: { ...(state.advAutoSet ?? {}), [action.pokeName]: false },
        advStats: {
          ...state.advStats,
          [action.pokeName]: { ...prev, [action.statKey]: clamped }
        }
      }
    }

    case 'SET_ADV_NATURE': {
      const prev = state.advStats[action.pokeName] || {}
      const updated: Partial<AdvOverride> = { ...prev, [action.field]: action.value }
      const other = action.field === 'natPlus' ? 'natMinus' : 'natPlus'
      if (action.value && updated[other] === action.value) updated[other] = ''
      return {
        ...state,
        advAutoSet: { ...(state.advAutoSet ?? {}), [action.pokeName]: false },
        advStats: { ...state.advStats, [action.pokeName]: updated }
      }
    }

    case 'SET_ADV_ABILITY': {
      const prev = state.advStats[action.pokeName] || {}
      return {
        ...state,
        advAutoSet: { ...(state.advAutoSet ?? {}), [action.pokeName]: false },
        advStats: {
          ...state.advStats,
          [action.pokeName]: { ...prev, ability: action.value }
        }
      }
    }

    case 'SET_TABLE_DATA':
      return { ...state, tableData: action.tableData }

    case 'UPDATE_TABLE_ROW': {
      const tableData = state.tableData.map(r =>
        r.name === action.pokeName ? { ...r, ...action.row } : r
      )
      return { ...state, tableData }
    }

    case 'SET_SORT':
      return { ...state, sortKey: action.key, sortAsc: action.asc }

    case 'SET_FILTER_SEARCH':
      return { ...state, filterSearch: action.value }

    case 'SET_FILTER_TYPE':
      return { ...state, filterType: action.value }

    case 'SET_FILTER_KO':
      return { ...state, filterKO: action.value }

    case 'SET_SHOW_LOW_USAGE':
      return { ...state, showLowUsage: action.value }

    case 'TOGGLE_FAVORITE': {
      const already = state.favorites.includes(action.pokeName)
      return {
        ...state,
        favorites: already
          ? state.favorites.filter(n => n !== action.pokeName)
          : [...state.favorites, action.pokeName],
        matchupAdvName: already && state.matchupAdvName === action.pokeName ? null : state.matchupAdvName,
      }
    }

    case 'SET_MATCHUP_ADV':
      return { ...state, matchupAdvName: action.pokeName }

    case 'SET_SLOT_NOTES':
      return { ...state, slotNotes: { ...state.slotNotes, [action.slot]: action.notes } }

    case 'SET_ADV_MOVE': {
      const prev = state.advMoves[action.pokeName] ?? ['', '', '', '']
      const next = [...prev] as [string, string, string, string]
      next[action.moveIdx] = action.value
      return {
        ...state,
        advAutoSet: { ...(state.advAutoSet ?? {}), [action.pokeName]: false },
        advMoves: { ...state.advMoves, [action.pokeName]: next },
      }
    }

    case 'SET_ADV_ITEM':
      return {
        ...state,
        advItems:   { ...state.advItems,   [action.pokeName]: action.value },
        advAutoSet: { ...(state.advAutoSet ?? {}), [action.pokeName]: false },
      }

    case 'TOGGLE_ADV_AUTO': {
      const isOn = state.advAutoSet?.[action.pokeName]
      if (isOn) {
        const snap = state.advPreAutoSet?.[action.pokeName]
        if (!snap) return { ...state, advAutoSet: { ...state.advAutoSet, [action.pokeName]: false } }
        return {
          ...state,
          advAutoSet:    { ...state.advAutoSet,    [action.pokeName]: false },
          advPreAutoSet: { ...state.advPreAutoSet, [action.pokeName]: undefined as unknown as AdvPreAutoSet },
          advStats: {
            ...state.advStats,
            [action.pokeName]: {
              ability: snap.ability,
              natPlus: snap.natPlus, natMinus: snap.natMinus,
              sp_hp: snap.sps.hp ?? 0, sp_at: snap.sps.at ?? 0, sp_df: snap.sps.df ?? 0,
              sp_sa: snap.sps.sa ?? 0, sp_sd: snap.sps.sd ?? 0, sp_sp: snap.sps.sp ?? 0,
            },
          },
          advMoves: { ...state.advMoves, [action.pokeName]: snap.moves },
          advItems: { ...state.advItems, [action.pokeName]: snap.item },
        }
      }
      // Toggle ON: save snapshot, apply CC
      const prevAdv = state.advStats[action.pokeName] || {}
      const snap: AdvPreAutoSet = {
        ability:  prevAdv.ability  || '',
        item:     state.advItems[action.pokeName] || '(No Item)',
        natPlus:  prevAdv.natPlus  || '',
        natMinus: prevAdv.natMinus || '',
        sps: {
          hp: prevAdv.sp_hp ?? 0, at: prevAdv.sp_at ?? 0, df: prevAdv.sp_df ?? 0,
          sa: prevAdv.sp_sa ?? 0, sd: prevAdv.sp_sd ?? 0, sp: prevAdv.sp_sp ?? 0,
        },
        moves: state.advMoves[action.pokeName] ?? ['', '', '', ''],
      }
      const newSps = action.ccSps ?? { hp: 0, at: 0, df: 0, sa: 0, sd: 0, sp: 0 }
      return {
        ...state,
        advAutoSet:    { ...state.advAutoSet,    [action.pokeName]: true },
        advPreAutoSet: { ...state.advPreAutoSet, [action.pokeName]: snap },
        advStats: {
          ...state.advStats,
          [action.pokeName]: {
            ability:  action.ccAbility,
            natPlus:  action.ccNatPlus,  natMinus: action.ccNatMinus,
            sp_hp: newSps.hp ?? 0, sp_at: newSps.at ?? 0, sp_df: newSps.df ?? 0,
            sp_sa: newSps.sa ?? 0, sp_sd: newSps.sd ?? 0, sp_sp: newSps.sp ?? 0,
          },
        },
        advMoves: { ...state.advMoves, [action.pokeName]: action.ccMoves },
        advItems: { ...state.advItems, [action.pokeName]: action.ccItem || '(No Item)' },
      }
    }

    case 'RESET_ADV': {
      const resetStats: Partial<AdvOverride> = {
        sp_hp: 0, sp_at: 0, sp_df: 0, sp_sa: 0, sp_sd: 0, sp_sp: 0,
        natPlus: '', natMinus: '', ability: action.ability,
      }
      return {
        ...state,
        advStats: { ...state.advStats, [action.pokeName]: resetStats },
        advMoves: { ...state.advMoves, [action.pokeName]: action.moves },
      }
    }

    case 'TOGGLE_DEFAULT_SET': {
      const team = [...state.team]
      const slot = { ...team[action.slot] }

      if (!slot.useDefaultSet) {
        const isMegaWithStone = !!(slot.megaForme && slot.preMegaItem)
        const snapshot: DefaultSetSnapshot = {
          ability: isMegaWithStone ? (slot.preMegaAbility || slot.ability) : slot.ability,
          item:    isMegaWithStone ? (slot.preMegaItem    || slot.item)    : slot.item,
          natPlus: slot.natPlus,
          natMinus: slot.natMinus,
          sps: { ...slot.sps },
          moves: [...slot.moves] as [string, string, string, string],
        }
        slot.preDefaultSet = snapshot
        slot.useDefaultSet = true

        if (!isMegaWithStone) {
          const topAbility = (slot.ccAbilities as Array<{ ability: { name: string } }> | null)?.[0]?.ability?.name
          if (topAbility) slot.ability = topAbility

          const topItem = (slot.ccItems as Array<{ item: { name: string } }> | null)?.[0]?.item?.name
          if (topItem) {
            slot.item = topItem
            for (let i = 0; i < team.length; i++) {
              if (i !== action.slot && team[i].item === topItem) {
                team[i] = { ...team[i], item: '(No Item)', useDefaultSet: false, preDefaultSet: null }
              }
            }
          }
        }

        applyTopMoves(slot, slot.megaForme || '')

        if (slot.ccNature) {
          slot.natPlus  = slot.ccNature.natPlus
          slot.natMinus = slot.ccNature.natMinus
        }
        if (slot.ccSps) {
          slot.sps = { ...slot.ccSps }
        }
      } else {
        slot.useDefaultSet = false
        if (slot.preDefaultSet) {
          if (slot.megaForme && slot.preMegaItem) {
            slot.preMegaAbility = slot.preDefaultSet.ability
            slot.preMegaItem    = slot.preDefaultSet.item
          } else {
            slot.ability = slot.preDefaultSet.ability
            slot.item    = slot.preDefaultSet.item
          }
          slot.natPlus  = slot.preDefaultSet.natPlus
          slot.natMinus = slot.preDefaultSet.natMinus
          slot.sps      = { ...slot.preDefaultSet.sps }
          slot.moves    = [...slot.preDefaultSet.moves] as [string, string, string, string]
          slot.preDefaultSet = null
        }
      }

      team[action.slot] = slot
      return { ...state, team }
    }

    default:
      return state
  }
}
