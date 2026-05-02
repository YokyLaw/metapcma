import { useState, useEffect } from 'react'
import { MOVE_DATA } from '../data/moveData'
import { NATURE_DATA } from '../data/constants'
import { getBaseNameForCC } from '../calc/teamHelpers'

export interface CCAbility { ability: { name: string }; percent: number }
export interface CCMove    { move: { name: string };    percent: number }
export interface CCItem    { item:  { name: string };   percent: number }

export interface AdvCCData {
  ccAbilities: CCAbility[]
  ccMoves:     CCMove[]
  ccItems:     CCItem[]
  ccNature:    { natPlus: string; natMinus: string } | null
  ccSps:       Record<string, number> | null
}

const cache    = new Map<string, AdvCCData>()
const fetching = new Set<string>()

const EMPTY: AdvCCData = { ccAbilities: [], ccMoves: [], ccItems: [], ccNature: null, ccSps: null }

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

export function useAdvCC(pokeName: string): AdvCCResult {
  const baseName  = getBaseNameForCC(pokeName)
  const isMegaRow = pokeName !== baseName

  const [data, setData] = useState<AdvCCData>(cache.get(pokeName) ?? EMPTY)

  useEffect(() => {
    if (!pokeName) { setData(EMPTY); return }
    const cached = cache.get(pokeName)
    if (cached) { setData(cached); return }
    if (fetching.has(pokeName)) return
    fetching.add(pokeName)

    fetch(`/api/cc/${encodeURIComponent(baseName)}`)
      .then(r => r.json())
      .then(raw => {
        const usages = raw?.usages ?? raw?.pokemon?.usages
        const ch = usages?.find((u: { provider: string }) => u.provider === 'champions')
        if (!ch) return

        const allMoves: CCMove[] = (ch.usageMoves ?? []).filter(
          (m: CCMove) => !!MOVE_DATA[m.move?.name ?? '']
        )
        const ccAbilities: CCAbility[] = isMegaRow ? [] : (ch.usageAbilities ?? [])
        const ccItems:     CCItem[]    = ch.usageItems ?? []
        const ccNature  = ch.usageSpreads?.length ? parseSpread(ch.usageSpreads) : null
        const ccSps     = ch.usageSpreads?.length ? parseSps(ch.usageSpreads)    : null

        const result: AdvCCData = { ccAbilities, ccMoves: allMoves, ccItems, ccNature, ccSps }
        cache.set(pokeName, result)
        setData(result)
      })
      .catch(() => { fetching.delete(pokeName) })
  }, [pokeName])

  return { ...data, isLoaded: cache.has(pokeName) }
}
