import { useEffect, useState } from 'react'
import { getBaseNameForCC } from '../calc/teamHelpers'

export type NatureStatKey = 'at' | 'df' | 'sa' | 'sd' | 'sp'

export interface TopSpread {
  nature: string
  natPlus: NatureStatKey | ''
  natMinus: NatureStatKey | ''
  evs: { hp: number; at: number; df: number; sa: number; sd: number; sp: number }
  percent: number
}

const cache = new Map<string, TopSpread[]>()
const inflight = new Map<string, Promise<TopSpread[]>>()

function parseEvs(raw: any): TopSpread['evs'] {
  const ev = raw?.evs || raw || {}
  return {
    hp: ev.hp ?? 0,
    at: ev.at ?? ev.atk ?? ev.attack ?? 0,
    df: ev.df ?? ev.def ?? ev.defense ?? 0,
    sa: ev.sa ?? ev.spa ?? 0,
    sd: ev.sd ?? ev.spd ?? 0,
    sp: ev.sp ?? ev.spe ?? ev.speed ?? 0,
  }
}

function extractNatureName(raw: any): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    if (typeof raw.nom === 'string' && raw.nom) return raw.nom
    if (typeof raw.name === 'string' && raw.name) return raw.name
  }
  return ''
}

const NATURE_API_KEY_TO_STAT: Record<string, NatureStatKey> = {
  atk: 'at', def: 'df', spa: 'sa', spd: 'sd', spe: 'sp',
}

function extractNatureStats(raw: any): { natPlus: NatureStatKey | ''; natMinus: NatureStatKey | '' } {
  if (!raw || typeof raw !== 'object') return { natPlus: '', natMinus: '' }
  let natPlus: NatureStatKey | '' = ''
  let natMinus: NatureStatKey | '' = ''
  for (const [apiKey, stat] of Object.entries(NATURE_API_KEY_TO_STAT)) {
    const v = (raw as any)[apiKey]
    if (v === 1) natPlus = stat
    else if (v === -1) natMinus = stat
  }
  return { natPlus, natMinus }
}

async function fetchTopSpreads(name: string): Promise<TopSpread[]> {
  if (cache.has(name)) return cache.get(name)!
  const existing = inflight.get(name)
  if (existing) return existing

  const p = (async () => {
    try {
      const baseName = getBaseNameForCC(name)
      const res = await fetch('/api/cc/' + encodeURIComponent(baseName))
      const json: any = await res.json()
      const usages = json.usages ?? json.pokemon?.usages
      const showdown = Array.isArray(usages)
        ? usages.find((u: any) => u.provider === 'showdown' && Array.isArray(u.usageSpreads) && u.usageSpreads.length > 0)
        : null
      const usageSpreads: any[] = showdown?.usageSpreads ?? []
      const out: TopSpread[] = []
      for (const us of usageSpreads) {
        const evs = parseEvs(us)
        const hasEvs = Object.values(evs).some(v => v > 0)
        if (!hasEvs) continue
        const { natPlus, natMinus } = extractNatureStats(us.nature)
        out.push({
          nature: extractNatureName(us.nature),
          natPlus,
          natMinus,
          evs,
          percent: typeof us.percent === 'number' ? us.percent : 0,
        })
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

export function useTopSpreads(names: string[]): Map<string, TopSpread[]> {
  const [map, setMap] = useState<Map<string, TopSpread[]>>(() => {
    const initial = new Map<string, TopSpread[]>()
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
          batch.map(n => fetchTopSpreads(n).then(r => [n, r] as const)),
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
