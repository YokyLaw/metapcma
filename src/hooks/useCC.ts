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
  pokemon?: { id?: number; usages?: CCUsage[]; ability_1?: unknown; ability_2?: unknown; ability_hidden?: unknown }
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

export function extractName(val: unknown): string {
  if (typeof val === 'string') return val
  const obj = val as Record<string, unknown>
  for (const k of ['en', 'fr', 'name', 'nom'] as const) {
    if (typeof obj?.[k] === 'string') return obj[k] as string
  }
  return ''
}

async function fetchCC(name: string): Promise<{
  ccMoves: CCMoveEntry[] | null
  ccItems: unknown[] | null
  ccAbilities: CCAbilityEntry[] | null
  ccNature: { natPlus: string; natMinus: string } | null
  ccSps: StatMap | null
  allAbilities: string[]
}> {
  const empty = { ccMoves: null, ccItems: null, ccAbilities: null, ccNature: null, ccSps: null, allAbilities: [] }
  try {
    const res = await fetch('/api/cc/' + encodeURIComponent(name))
    const json: CCApiResponse = await res.json()
    const allAbilities = [json.pokemon?.ability_1, json.pokemon?.ability_2, json.pokemon?.ability_hidden]
      .map(a => extractName(a as unknown))
      .filter(Boolean)
    const usages = json.usages ?? json.pokemon?.usages
    const championsUsage = usages?.find(u => u.provider === 'champions')

    if (championsUsage) {
      const { nature: ccNature, sps: ccSps } = championsUsage.usageSpreads?.length
        ? parseTopSpread(championsUsage.usageSpreads)
        : { nature: null, sps: null }
      const ccMoves = championsUsage.usageMoves?.map(m => ({
        move: { name: extractName((m as { move?: { name?: unknown } }).move?.name) },
        percent: (m as { percent?: number }).percent ?? 0,
      })) ?? null
      const ccAbilities = championsUsage.usageAbilities?.map(e => ({
        ability: { name: extractName((e as { ability?: { name?: unknown } }).ability?.name) },
        percent: (e as { percent?: number }).percent ?? 0,
      })) ?? null
      const ccItems = championsUsage.usageItems?.map(i => ({
        item: { name: extractName((i as { item?: { name?: unknown } }).item?.name) },
        percent: (i as { percent?: number }).percent ?? 0,
      })) ?? null
      return { ccMoves, ccItems, ccAbilities, ccNature, ccSps, allAbilities }
    }

    const id = json.pokemon?.id ?? json.id
    if (!id) return { ...empty, allAbilities }

    const movesRes = await fetch('/api/cc/moves/' + id)
    const movesData: unknown = await movesRes.json()
    const names = parseMoveNames(movesData)
    const ccMoves: CCMoveEntry[] = names.map(n => ({ move: { name: n }, percent: 0 }))

    return { ...empty, allAbilities, ccMoves: ccMoves.length > 0 ? ccMoves : null }
  } catch {
    return empty
  }
}

export function useFetchCCForSlot() {
  const { dispatch } = useAppState()

  return function fetchForSlot(slotIdx: number, pokeName: string) {
    const name = getBaseNameForCC(pokeName)
    fetchCC(name).then(({ ccMoves, ccItems, ccAbilities, ccNature, ccSps, allAbilities }) => {
      dispatch({
        type: 'SET_CC_DATA',
        slot: slotIdx,
        pokemon: pokeName,
        ccMoves,
        ccItems,
        ccAbilities,
        ccNature,
        ccSps,
        allAbilities,
      })
    })
  }
}
