import type { TeamSlot, StatMap, BoostMap, AdvOverride, TableRow, Weather, Terrain, SortKey } from '../types'
import { POKE_DATA } from '../data/pokeData'
import { getAbilitiesFor } from '../calc/teamHelpers'
import { MEGA_MAP } from '../data/megaMap'

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
  }
}

export interface AppState {
  team: TeamSlot[]
  selectedSlot: number | null
  weather: Weather
  terrain: Terrain
  advStats: Record<string, Partial<AdvOverride>>
  tableData: TableRow[]
  sortKey: SortKey
  sortAsc: boolean
  filterSearch: string
  filterType: string
  filterKO: '' | 'ohko' | 'ko'
  showLowUsage: boolean
}

export const initialState: AppState = {
  team: Array.from({ length: 6 }, (_, i) => makeSlot(i)),
  selectedSlot: null,
  weather: '',
  terrain: '',
  advStats: {},
  tableData: [],
  sortKey: 'usage',
  sortAsc: false,
  filterSearch: '',
  filterType: '',
  filterKO: '',
  showLowUsage: false,
}

export type Action =
  | { type: 'SELECT_SLOT'; slot: number }
  | { type: 'UPDATE_SLOT_FIELD'; slot: number; field: string; value: string }
  | { type: 'UPDATE_MOVE'; slot: number; moveIdx: number; value: string }
  | { type: 'UPDATE_BOOST'; slot: number; stat: keyof BoostMap; value: number }
  | { type: 'UPDATE_SP'; slot: number; stat: keyof StatMap; value: number }
  | { type: 'SELECT_MEGA'; slot: number; megaForme: string; stone: string }
  | { type: 'SET_CC_DATA'; slot: number; pokemon: string; ccMoves: unknown[] | null; ccItems: unknown[] | null }  // eslint-disable-line @typescript-eslint/no-explicit-any
  | { type: 'SET_WEATHER'; weather: Weather }
  | { type: 'SET_TERRAIN'; terrain: Terrain }
  | { type: 'SET_ADV_STAT'; pokeName: string; statKey: 'sp_hp' | 'sp_df' | 'sp_sd'; value: number }
  | { type: 'SET_ADV_NATURE'; pokeName: string; field: 'natPlus' | 'natMinus'; value: string }
  | { type: 'SET_ADV_ABILITY'; pokeName: string; value: string }
  | { type: 'SET_TABLE_DATA'; tableData: TableRow[] }
  | { type: 'UPDATE_TABLE_ROW'; pokeName: string; row: Partial<TableRow> }
  | { type: 'SET_SORT'; key: SortKey; asc: boolean }
  | { type: 'SET_FILTER_SEARCH'; value: string }
  | { type: 'SET_FILTER_TYPE'; value: string }
  | { type: 'SET_FILTER_KO'; value: '' | 'ohko' | 'ko' }
  | { type: 'SET_SHOW_LOW_USAGE'; value: boolean }

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
        slot.ccMoves   = null
        slot.ccItems   = null
        slot.moves     = ['','','','']
        slot.item      = '(No Item)'
      }
      if (action.field === 'natPlus'  && action.value && action.value === slot.natMinus) slot.natMinus = ''
      if (action.field === 'natMinus' && action.value && action.value === slot.natPlus)  slot.natPlus  = ''

      team[action.slot] = slot
      return { ...state, team }
    }

    case 'UPDATE_MOVE': {
      const team = [...state.team]
      const moves = [...team[action.slot].moves] as [string,string,string,string]
      moves[action.moveIdx] = action.value
      team[action.slot] = { ...team[action.slot], moves }
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
      team[action.slot] = {
        ...team[action.slot],
        sps: { ...team[action.slot].sps, [action.stat]: action.value }
      }
      return { ...state, team }
    }

    case 'SELECT_MEGA': {
      const team = [...state.team]
      const slot = { ...team[action.slot] }
      slot.megaForme = action.megaForme

      if (action.megaForme && action.stone) {
        slot.item = action.stone
        const megaAbilities = getAbilitiesFor(action.megaForme)
        const megaData = POKE_DATA[action.megaForme]
        slot.ability = megaAbilities ? megaAbilities[0] : (megaData ? (megaData.ab as string) : slot.ability)
      } else {
        const baseAbilities = getAbilitiesFor(slot.pokemon)
        const baseData = POKE_DATA[slot.pokemon]
        slot.ability = baseAbilities ? baseAbilities[0] : (baseData ? (baseData.ab as string) : '')
        const megaOptions = MEGA_MAP[slot.pokemon]
        if (megaOptions && Object.values(megaOptions).includes(slot.item)) {
          slot.item = '(No Item)'
        }
      }

      team[action.slot] = slot
      return { ...state, team }
    }

    case 'SET_CC_DATA': {
      const team = [...state.team]
      if (team[action.slot].pokemon === action.pokemon) {
        team[action.slot] = {
          ...team[action.slot],
          ccMoves: action.ccMoves as string[] | null,
          ccItems: action.ccItems as string[] | null,
        }
      }
      return { ...state, team }
    }

    case 'SET_WEATHER':
      return { ...state, weather: action.weather }

    case 'SET_TERRAIN':
      return { ...state, terrain: action.terrain }

    case 'SET_ADV_STAT': {
      const prev = state.advStats[action.pokeName] || {}
      return {
        ...state,
        advStats: {
          ...state.advStats,
          [action.pokeName]: { ...prev, [action.statKey]: action.value }
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
        advStats: { ...state.advStats, [action.pokeName]: updated }
      }
    }

    case 'SET_ADV_ABILITY': {
      const prev = state.advStats[action.pokeName] || {}
      return {
        ...state,
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

    default:
      return state
  }
}
