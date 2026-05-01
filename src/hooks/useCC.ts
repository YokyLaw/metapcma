import { useAppState } from '../context/AppContext'
import { getBaseNameForCC } from '../calc/teamHelpers'
import { NATURE_DATA } from '../data/constants'
import type { CCMoveEntry } from '../calc/teamHelpers'
import type { StatMap } from '../types'

export interface CCAbilityEntry { ability: { name: string }; percent: number }

interface CCSpreadEntry {
  nature?: string
  evs?: Record<string, number>
  hp?: number; at?: number; atk?: number; attack?: number
  df?: number; def?: number; defense?: number
  sa?: number; spa?: number
  sd?: number; spd?: number
  sp?: number; spe?: number; speed?: number
  percent?: number
}

interface CCUsage {
  provider: string
  usageMoves?: CCMoveEntry[]
  usageItems?: unknown[]
  usageAbilities?: CCAbilityEntry[]
  usageSpreads?: CCSpreadEntry[]
}

function parseTopSpread(spreads: CCSpreadEntry[]): { nature: { natPlus: string; natMinus: string } | null; sps: StatMap | null } {
  const top = spreads[0]
  if (!top) return { nature: null, sps: null }

  let nature: { natPlus: string; natMinus: string } | null = null
  if (top.nature) {
    const nd = NATURE_DATA[top.nature]
    if (nd) nature = { natPlus: nd[0] || '', natMinus: nd[1] || '' }
  }

  const ev = top.evs || top
  const sps: StatMap = {
    hp: ev.hp ?? 0,
    at: ev.at ?? ev.atk ?? ev.attack ?? 0,
    df: ev.df ?? ev.def ?? ev.defense ?? 0,
    sa: ev.sa ?? ev.spa ?? 0,
    sd: ev.sd ?? ev.spd ?? 0,
    sp: ev.sp ?? ev.spe ?? ev.speed ?? 0,
  }
  const hasEvs = Object.values(sps).some(v => v > 0)

  return { nature, sps: hasEvs ? sps : null }
}

interface CCApiResponse {
  usages?: CCUsage[]
  pokemon?: { id?: number; usages?: CCUsage[] }
  id?: number
}

function parseMoveNames(data: unknown): string[] {
  if (Array.isArray(data)) {
    return (data as unknown[]).map(m =>
      typeof m === 'string' ? m : (m as { name?: string; move?: { name?: string } }).name ?? (m as { move?: { name?: string } }).move?.name ?? ''
    ).filter(Boolean)
  }
  const obj = data as { moves?: unknown } | null
  if (obj?.moves) return parseMoveNames(obj.moves)
  return []
}

async function fetchCC(name: string): Promise<{
  ccMoves: CCMoveEntry[] | null
  ccItems: unknown[] | null
  ccAbilities: CCAbilityEntry[] | null
  ccNature: { natPlus: string; natMinus: string } | null
  ccSps: StatMap | null
}> {
  const empty = { ccMoves: null, ccItems: null, ccAbilities: null, ccNature: null, ccSps: null }
  try {
    const res = await fetch('/api/cc/' + encodeURIComponent(name))
    const json: CCApiResponse = await res.json()
    const usages = json.usages ?? json.pokemon?.usages
    const championsUsage = usages?.find(u => u.provider === 'champions')

    if (championsUsage) {
      const { nature: ccNature, sps: ccSps } = championsUsage.usageSpreads?.length
        ? parseTopSpread(championsUsage.usageSpreads)
        : { nature: null, sps: null }
      return {
        ccMoves:     championsUsage.usageMoves ?? null,
        ccItems:     championsUsage.usageItems ?? null,
        ccAbilities: championsUsage.usageAbilities ?? null,
        ccNature, ccSps,
      }
    }

    const id = json.pokemon?.id ?? json.id
    if (!id) return empty

    const movesRes = await fetch('/api/cc/moves/' + id)
    const movesData: unknown = await movesRes.json()
    const names = parseMoveNames(movesData)
    const ccMoves: CCMoveEntry[] = names.map(n => ({ move: { name: n }, percent: 0 }))

    return { ...empty, ccMoves: ccMoves.length > 0 ? ccMoves : null }
  } catch {
    return empty
  }
}

export function useFetchCCForSlot() {
  const { dispatch } = useAppState()

  return function fetchForSlot(slotIdx: number, pokeName: string) {
    const name = getBaseNameForCC(pokeName)
    fetchCC(name).then(({ ccMoves, ccItems, ccAbilities, ccNature, ccSps }) => {
      dispatch({
        type: 'SET_CC_DATA',
        slot: slotIdx,
        pokemon: pokeName,
        ccMoves,
        ccItems,
        ccAbilities,
        ccNature,
        ccSps,
      })
    })
  }
}
