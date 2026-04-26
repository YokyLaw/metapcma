export interface PokeEntry {
  t1: string
  t2?: string
  bs: { hp:number; at:number; df:number; sa:number; sd:number; sp:number; sl?:number }
  w: number
  ab: string
  formes?: string[] | null
  [k: string]: unknown
}

export interface MoveEntry {
  type: string
  category: 'Physical' | 'Special' | 'Status'
  bp: number
  makesContact?: boolean
  isSpread?: boolean
  isPriority?: boolean
  isBullet?: boolean
  isPunch?: boolean
  isBite?: boolean
  isSound?: boolean
  isWind?: boolean
  hasSecondaryEffect?: boolean
  statChange?: unknown[]
  [k: string]: unknown
}

export type StatKey = 'hp'|'at'|'df'|'sa'|'sd'|'sp'
export type BoostKey = 'at'|'df'|'sa'|'sd'|'sp'
export type StatMap = Record<StatKey, number>
export type BoostMap = Record<BoostKey, number>

export interface TeamSlot {
  id: number
  pokemon: string
  megaForme: string
  ability: string
  item: string
  natPlus: string
  natMinus: string
  sps: StatMap
  boosts: BoostMap
  moves: [string, string, string, string]
  ccMoves: string[] | null
  ccItems: string[] | null
}

export interface AdvOverride {
  sp_hp: number
  sp_df: number
  sp_sd: number
  natPlus: string
  natMinus: string
  ability: string
}

export interface TableRow {
  name: string
  type1: string
  type2: string
  usage: number
  move: string
  moveType: string
  moveCategory: string
  minPct: number
  maxPct: number
  minDmg: number
  maxDmg: number
  defHP: number
  isOHKO: boolean
  isKO: boolean
}

export type Weather = '' | 'Sun' | 'Rain' | 'Sand' | 'Snow'
export type Terrain = '' | 'Electric' | 'Grassy' | 'Psychic' | 'Misty'
export type SortKey = 'usage' | 'name' | 'type' | 'move' | 'minPct' | 'maxPct'

export interface CCData {
  moves: string[]
  items: string[]
}
