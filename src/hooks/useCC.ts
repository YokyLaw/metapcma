import { useAppState } from '../context/AppContext'
import { getBaseNameForCC } from '../calc/teamHelpers'
import type { CCMoveEntry } from '../calc/teamHelpers'

interface CCUsage {
  provider: string
  usageMoves?: CCMoveEntry[]
  usageItems?: unknown[]
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

async function fetchCC(name: string): Promise<{ ccMoves: CCMoveEntry[] | null; ccItems: unknown[] | null }> {
  try {
    const res = await fetch('/api/cc/' + encodeURIComponent(name))
    const json: CCApiResponse = await res.json()
    const usages = json.usages ?? json.pokemon?.usages
    const championsUsage = usages?.find(u => u.provider === 'champions')

    if (championsUsage) {
      return {
        ccMoves: championsUsage.usageMoves ?? null,
        ccItems: championsUsage.usageItems ?? null,
      }
    }

    const id = json.pokemon?.id ?? json.id
    if (!id) return { ccMoves: null, ccItems: null }

    const movesRes = await fetch('/api/cc/moves/' + id)
    const movesData: unknown = await movesRes.json()
    const names = parseMoveNames(movesData)
    const ccMoves: CCMoveEntry[] = names.map(n => ({ move: { name: n }, percent: 0 }))

    return { ccMoves: ccMoves.length > 0 ? ccMoves : null, ccItems: null }
  } catch {
    return { ccMoves: null, ccItems: null }
  }
}

export function useFetchCCForSlot() {
  const { dispatch } = useAppState()

  return function fetchForSlot(slotIdx: number, pokeName: string) {
    const name = getBaseNameForCC(pokeName)
    fetchCC(name).then(({ ccMoves, ccItems }) => {
      dispatch({
        type: 'SET_CC_DATA',
        slot: slotIdx,
        pokemon: pokeName,
        ccMoves,
        ccItems,
      })
    })
  }
}
