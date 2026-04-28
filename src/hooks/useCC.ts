import { useAppState } from '../context/AppContext'
import { getCCId } from '../calc/teamHelpers'
import { CC_IDS } from '../data/usageData'

interface UsageAbilityEntry { ability: { name: string }; percent: number }

interface CCData {
  usageMoves?: unknown[]
  usageItems?: unknown[]
  usageAbilities?: UsageAbilityEntry[]
}

interface CCCacheEntry {
  ready: boolean
  data?: CCData | null
  promise?: Promise<CCData | null>
}

const CC_CACHE: Record<number, CCCacheEntry> = {}

function fetchCC(id: number): Promise<CCData | null> {
  if (CC_CACHE[id]?.ready) return Promise.resolve(CC_CACHE[id].data ?? null)
  if (CC_CACHE[id]?.promise) return CC_CACHE[id].promise!

  const promise = fetch('https://www.coupcritique.fr/api/pokemons/' + id)
    .then(r => r.json())
    .then((json): CCData | null => {
      let usage: CCData | null = null
      if (json.pokemon?.usages) {
        usage = json.pokemon.usages.find((u: { provider: string }) => u.provider === 'champions') ?? null
      }
      CC_CACHE[id] = { ready: true, data: usage }
      return usage
    })
    .catch((): null => {
      CC_CACHE[id] = { ready: true, data: null }
      return null
    })

  CC_CACHE[id] = { ready: false, promise }
  return promise
}

export function getCCData(pokeName: string): CCData | null | undefined {
  const id = getCCId(pokeName)
  if (!id) return null
  const entry = CC_CACHE[id]
  return entry?.ready ? (entry.data ?? null) : undefined
}

export function getTopCCAbility(pokeName: string): string | null {
  const id = getCCId(pokeName)
  if (!id) return null
  const entry = CC_CACHE[id]
  if (!entry?.ready || !entry.data?.usageAbilities?.length) return null
  return entry.data.usageAbilities[0].ability.name ?? null
}

export function prefetchAll(): void {
  const seen = new Set<number>()
  Object.values(CC_IDS).forEach(id => {
    if (!seen.has(id)) { seen.add(id); fetchCC(id) }
  })
}

export function useFetchCCForSlot() {
  const { dispatch } = useAppState()

  return function fetchForSlot(slotIdx: number, pokeName: string) {
    const id = getCCId(pokeName)
    if (!id) return

    const entry = CC_CACHE[id]
    if (entry?.ready) {
      const data = entry.data ?? null
      dispatch({
        type: 'SET_CC_DATA',
        slot: slotIdx,
        pokemon: pokeName,
        ccMoves: data?.usageMoves ?? null,
        ccItems: data?.usageItems ?? null,
      })
      return
    }

    fetchCC(id).then(data => {
      dispatch({
        type: 'SET_CC_DATA',
        slot: slotIdx,
        pokemon: pokeName,
        ccMoves: data?.usageMoves ?? null,
        ccItems: data?.usageItems ?? null,
      })
    })
  }
}
