import { useState, useEffect } from 'react'
import { getBaseNameForCC } from '../calc/teamHelpers'

const cache = new Map<string, string[]>()
const inflight = new Map<string, Promise<string[]>>()

function extractMoveNames(data: unknown): string[] {
  if (Array.isArray(data)) {
    return (data as unknown[])
      .map(m => {
        if (typeof m === 'string') return { name: m, loss: false }
        const o = m as { name?: string; move?: { name?: string }; pokemonMove?: { championsLoss?: boolean } }
        const name = o.name ?? o.move?.name ?? ''
        const loss = o.pokemonMove?.championsLoss === true
        return { name, loss }
      })
      .filter(e => e.name && !e.loss)
      .map(e => e.name)
  }
  const obj = data as { moves?: unknown } | null
  if (obj?.moves) return extractMoveNames(obj.moves)
  return []
}

async function fetchAllMoves(pokeName: string): Promise<string[]> {
  const base = getBaseNameForCC(pokeName)
  if (cache.has(base)) return cache.get(base)!
  if (inflight.has(base)) return inflight.get(base)!
  const p = (async () => {
    try {
      const r = await fetch('/api/cc/' + encodeURIComponent(base))
      const j = await r.json()
      const id = j?.pokemon?.id ?? j?.id
      if (!id) return []
      const mr = await fetch('/api/cc/moves/' + id)
      const md = await mr.json()
      const names = extractMoveNames(md)
      cache.set(base, names)
      return names
    } catch {
      return []
    } finally {
      inflight.delete(base)
    }
  })()
  inflight.set(base, p)
  return p
}

export function useAllMoves(pokeName: string) {
  const [moves, setMoves] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!pokeName) {
      setMoves([])
      return
    }
    let cancelled = false
    setLoading(true)
    fetchAllMoves(pokeName).then(m => {
      if (cancelled) return
      setMoves(m)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [pokeName])

  return { moves, loading }
}
