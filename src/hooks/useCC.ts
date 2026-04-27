import { useAppState } from '../context/AppContext'
import { getBaseNameForCC } from '../calc/teamHelpers'
import { USAGE_MAP } from '../data/usageData'

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

const CC_CACHE: Record<string, CCCacheEntry> = {}

function fetchCCByName(baseName: string): Promise<CCData | null> {
  if (CC_CACHE[baseName]?.ready) return Promise.resolve(CC_CACHE[baseName].data ?? null)
  if (CC_CACHE[baseName]?.promise) return CC_CACHE[baseName].promise!

  const promise = fetch('https://www.coupcritique.fr/api/pokemon-name/' + encodeURIComponent(baseName))
    .then(r => r.json())
    .then((json): CCData | null => {
      const usages = json.usages ?? json.pokemon?.usages
      const usage = usages?.find((u: { provider: string }) => u.provider === 'champions') ?? null
      CC_CACHE[baseName] = { ready: true, data: usage }
      return usage
    })
    .catch((): null => {
      CC_CACHE[baseName] = { ready: true, data: null }
      return null
    })

  CC_CACHE[baseName] = { ready: false, promise }
  return promise
}

export function getCCData(pokeName: string): CCData | null | undefined {
  const baseName = getBaseNameForCC(pokeName)
  const entry = CC_CACHE[baseName]
  return entry?.ready ? (entry.data ?? null) : undefined
}

export function getTopCCAbility(pokeName: string): string | null {
  const baseName = getBaseNameForCC(pokeName)
  const entry = CC_CACHE[baseName]
  if (!entry?.ready || !entry.data?.usageAbilities?.length) return null
  return entry.data.usageAbilities[0].ability.name ?? null
}

export function prefetchAll(): void {
  const seen = new Set<string>()
  Object.keys(USAGE_MAP).forEach(name => {
    const base = getBaseNameForCC(name)
    if (!seen.has(base)) { seen.add(base); fetchCCByName(base) }
  })
}

export function useFetchCCForSlot() {
  const { dispatch } = useAppState()

  return function fetchForSlot(slotIdx: number, pokeName: string) {
    const baseName = getBaseNameForCC(pokeName)

    const entry = CC_CACHE[baseName]
    if (entry?.ready) {
      dispatch({
        type: 'SET_CC_DATA',
        slot: slotIdx,
        pokemon: pokeName,
        ccMoves: entry.data?.usageMoves ?? null,
        ccItems: entry.data?.usageItems ?? null,
      })
      return
    }

    fetchCCByName(baseName).then(data => {
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
