import { useEffect, useState } from 'react'
import { getBaseNameForCC } from '../calc/teamHelpers'
import { getMoveData } from '../calc/moveHelpers'
import { extractName } from './useCC'

export interface TopMove {
  name: string
  percent: number | null
}

const cache = new Map<string, TopMove[]>()
const inflight = new Map<string, Promise<TopMove[]>>()

async function fetchTopMoves(name: string): Promise<TopMove[]> {
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
      const usageMoves: any[] = champions?.usageMoves ?? []
      const out: TopMove[] = []
      for (const um of usageMoves) {
        const mv = extractName(um?.move?.name)
        if (!mv) continue
        const md = getMoveData(mv)
        if (!md) continue
        if (md.category !== 'Physical' && md.category !== 'Special') continue
        if (!md.bp || md.bp <= 0) continue
        out.push({
          name: mv,
          percent: typeof um.percent === 'number' ? um.percent : null,
        })
        if (out.length >= 4) break
      }
      cache.set(name, out)
      return out
    } catch {
      cache.set(name, [])
      return []
    } finally {
      inflight.delete(name)
    }
  })()

  inflight.set(name, p)
  return p
}

export function useTopMoves(names: string[]): Map<string, TopMove[]> {
  const [map, setMap] = useState<Map<string, TopMove[]>>(() => {
    const initial = new Map<string, TopMove[]>()
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
          batch.map(n => fetchTopMoves(n).then(r => [n, r] as const)),
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
