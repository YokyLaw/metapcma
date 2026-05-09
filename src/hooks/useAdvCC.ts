import { useState, useEffect } from 'react'
import { getMoveData } from '../calc/moveHelpers'
import { NATURE_DATA } from '../data/constants'
import { getBaseNameForCC } from '../calc/teamHelpers'

export interface CCAbility { ability: { name: string }; percent: number }
export interface CCMove    { move: { name: string };    percent: number }
export interface CCItem    { item:  { name: string };   percent: number }

export interface AdvCCData {
  ccAbilities:  CCAbility[]
  ccMoves:      CCMove[]
  ccItems:      CCItem[]
  ccNature:     { natPlus: string; natMinus: string } | null
  ccSps:        Record<string, number> | null
  allAbilities: string[]
}

const cache    = new Map<string, AdvCCData>()
const inflight = new Map<string, Promise<AdvCCData | null>>()
const listeners = new Map<string, Set<() => void>>()

const MAX_CONCURRENT = 6
const queue: Array<() => void> = []
let active = 0

function runNext() {
  if (active >= MAX_CONCURRENT) return
  const job = queue.shift()
  if (!job) return
  active++
  job()
}

function schedule(job: () => Promise<unknown>): Promise<void> {
  return new Promise(resolve => {
    queue.push(() => {
      job().finally(() => {
        active--
        runNext()
        resolve()
      })
    })
    runNext()
  })
}

const EMPTY: AdvCCData = { ccAbilities: [], ccMoves: [], ccItems: [], ccNature: null, ccSps: null, allAbilities: [] }

function notify(pokeName: string) {
  const set = listeners.get(pokeName)
  if (!set) return
  set.forEach(fn => fn())
}

function subscribe(pokeName: string, fn: () => void): () => void {
  let set = listeners.get(pokeName)
  if (!set) { set = new Set(); listeners.set(pokeName, set) }
  set.add(fn)
  return () => {
    set!.delete(fn)
    if (set!.size === 0) listeners.delete(pokeName)
  }
}

function parseSpread(spreads: unknown[]): { natPlus: string; natMinus: string } | null {
  const top = spreads[0] as Record<string, unknown> | undefined
  if (!top?.nature || typeof top.nature !== 'string') return null
  const nd = NATURE_DATA[top.nature]
  return nd ? { natPlus: nd[0] || '', natMinus: nd[1] || '' } : null
}

function parseSps(spreads: unknown[]): Record<string, number> | null {
  const top = spreads[0] as Record<string, unknown> | undefined
  if (!top) return null
  const ev = (top.evs as Record<string, number> | undefined) ?? top
  const sps = {
    hp: (ev.hp as number) ?? 0,
    at: (ev.at ?? ev.atk ?? ev.attack ?? 0) as number,
    df: (ev.df ?? ev.def ?? ev.defense ?? 0) as number,
    sa: (ev.sa ?? ev.spa ?? 0) as number,
    sd: (ev.sd ?? ev.spd ?? 0) as number,
    sp: (ev.sp ?? ev.spe ?? ev.speed ?? 0) as number,
  }
  return Object.values(sps).some(v => v > 0) ? sps : null
}

export interface AdvCCResult extends AdvCCData { isLoaded: boolean }

function extractName(val: unknown): string {
  if (typeof val === 'string') return val
  const o = val as Record<string, unknown>
  for (const k of ['en', 'fr', 'name', 'nom']) {
    if (typeof o?.[k] === 'string') return o[k] as string
  }
  return ''
}

function fetchPokeData(pokeName: string, baseName: string, isMegaRow: boolean): Promise<AdvCCData | null> {
  const existing = inflight.get(pokeName)
  if (existing) return existing
  const p = (async () => {
    try {
      let result: AdvCCData | null = null
      await schedule(async () => {
        const res = await fetch(`/api/cc/${encodeURIComponent(baseName)}`)
        const raw = await res.json()
        const allAbilities = [raw?.pokemon?.ability_1, raw?.pokemon?.ability_2, raw?.pokemon?.ability_hidden]
          .map(a => extractName(a))
          .filter(Boolean)
        const usages = raw?.usages ?? raw?.pokemon?.usages
        const ch = usages?.find((u: { provider: string }) => u.provider === 'champions')
        if (!ch) {
          if (allAbilities.length) result = { ...EMPTY, allAbilities }
          return
        }
        const allMoves: CCMove[] = (ch.usageMoves ?? [])
          .map((m: unknown) => {
            const e = m as { move: { name: unknown }; percent: number }
            return { move: { name: extractName(e.move?.name) }, percent: e.percent }
          })
          .filter((m: CCMove) => !!getMoveData(m.move.name))
        const ccAbilities: CCAbility[] = isMegaRow ? [] : (ch.usageAbilities ?? []).map((e: unknown) => {
          const entry = e as { ability: { name: unknown }; percent: number }
          return { ability: { name: extractName(entry.ability?.name) }, percent: entry.percent }
        })
        const ccItems: CCItem[] = (ch.usageItems ?? []).map((e: unknown) => {
          const entry = e as { item: { name: unknown }; percent: number }
          return { item: { name: extractName(entry.item?.name) }, percent: entry.percent }
        })
        const ccNature = ch.usageSpreads?.length ? parseSpread(ch.usageSpreads) : null
        const ccSps    = ch.usageSpreads?.length ? parseSps(ch.usageSpreads)    : null
        result = { ccAbilities, ccMoves: allMoves, ccItems, ccNature, ccSps, allAbilities }
      })
      if (result) {
        cache.set(pokeName, result)
        notify(pokeName)
      }
      return result
    } catch {
      return null
    } finally {
      inflight.delete(pokeName)
    }
  })()
  inflight.set(pokeName, p)
  return p
}

export function useAdvCC(pokeName: string, enabled: boolean = true): AdvCCResult {
  const baseName  = getBaseNameForCC(pokeName)
  const isMegaRow = pokeName !== baseName

  const [data, setData] = useState<AdvCCData>(cache.get(pokeName) ?? EMPTY)
  const [loadedName, setLoadedName] = useState(cache.has(pokeName) ? pokeName : '')

  useEffect(() => {
    if (!pokeName) { setData(EMPTY); setLoadedName(''); return }
    const cached = cache.get(pokeName)
    if (cached) { setData(cached); setLoadedName(pokeName); return }
    setLoadedName('')
    if (!enabled) return

    let cancelled = false
    const unsub = subscribe(pokeName, () => {
      if (cancelled) return
      const c = cache.get(pokeName)
      if (c) { setData(c); setLoadedName(pokeName) }
    })

    fetchPokeData(pokeName, baseName, isMegaRow).then(result => {
      if (cancelled || !result) return
      setData(result)
      setLoadedName(pokeName)
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [pokeName, enabled])

  return { ...data, isLoaded: loadedName === pokeName }
}
