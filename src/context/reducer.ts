import type { TeamSlot, StatMap, BoostMap, AdvOverride, TableRow, Weather, Terrain, SortKey, DefaultSetSnapshot } from '../types'
import { POKE_DATA } from '../data/pokeData'
import { MOVE_DATA } from '../data/moveData'
import { getAbilitiesFor } from '../calc/teamHelpers'
import { MEGA_MAP } from '../data/megaMap'

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
      team[action.slot] = {
        ...slot,
        sps: { ...slot.sps, [action.stat]: action.value },
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
