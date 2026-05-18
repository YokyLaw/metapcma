import { useEffect, useState } from 'react'
import { getBaseNameForCC } from '../calc/teamHelpers'
import { extractName } from './useCC'

export interface TopAbility {
  name: string
  percent: number | null
}

const cache = new Map<string, TopAbility | null>()
const inflight = new Map<string, Promise<TopAbility | null>>()

async function fetchTopAbility(name: string): Promise<TopAbility | null> {
  if (cache.has(name)) return cache.get(name)!
  const existing = inflight.get(name)
  if (existing) return existing

  const p = (async () => {
    try {
      const baseName = getBaseNameForCC(name)
      const res = await fetch('/api/cc/' + encodeURIComponent(baseName))
      const json: any = await res.json()
      const usages = json.usages ?? json.pokemon?.usages
      const champions = Array.isArray(usages)
        ? usages.find((u: any) => u.provider === 'champions')
        : null
      const usageAbilities: any[] = champions?.usageAbilities ?? []
      if (usageAbilities.length > 0) {
        const top = usageAbilities[0]
        const abilityName = extractName(top?.ability?.name)
        if (abilityName) {
          const result: TopAbility = {
            name: abilityName,
            percent: typeof top.percent === 'number' ? top.percent : null,
          }
          cache.set(name, result)
          return result
        }
      }
      const fallback = [
        json?.pokemon?.ability_1,
        json?.pokemon?.ability_2,
        json?.pokemon?.ability_hidden,
      ]
        .map(a => extractName(a))
        .filter(Boolean)
      const result = fallback[0] ? { name: fallback[0], percent: null } : null
      cache.set(name, result)
      return result
    } catch {
      cache.set(name, null)
      return null
    } finally {
      inflight.delete(name)
    }
  })()

  inflight.set(name, p)
  return p
}

export function useTopAbilities(names: string[]): Map<string, TopAbility | null> {
  const [map, setMap] = useState<Map<string, TopAbility | null>>(() => {
    const initial = new Map<string, TopAbility | null>()
    for (const n of names) {
      if (cache.has(n)) initial.set(n, cache.get(n)!)
    }
    return initial
  })

  const key = names.join('|')

  useEffect(() => {
    let cancelled = false

    setMap(prev => {
      const next = new Map(prev)
      for (const n of names) {
        if (cache.has(n) && !next.has(n)) next.set(n, cache.get(n)!)
      }
      return next
    })

    const pending = names.filter(n => !cache.has(n))
    if (pending.length === 0) return

    const BATCH = 6
    ;(async () => {
      for (let i = 0; i < pending.length; i += BATCH) {
        if (cancelled) return
        const batch = pending.slice(i, i + BATCH)
        const results = await Promise.all(
          batch.map(n => fetchTopAbility(n).then(r => [n, r] as const)),
        )
        if (cancelled) return
        setMap(prev => {
          const next = new Map(prev)
          for (const [n, r] of results) next.set(n, r)
          return next
        })
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return map
}
