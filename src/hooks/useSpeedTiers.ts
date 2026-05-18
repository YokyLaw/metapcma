import { useState, useEffect } from 'react'
import { MEGA_MAP } from '../data/megaMap'

export interface SpeedTierEntry {
  pokemon: {
    name: string
    nom: string
  }
  speed: number
  bonus: string
  percent: number | null
  rank: number | null
}

const CC_MEGA_NAME_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const forms of Object.values(MEGA_MAP)) {
    for (const megaName of Object.keys(forms)) {
      const suffix = megaName.replace(/^Mega /, '')
      const xyMatch = suffix.match(/^(.+) ([XY])$/)
      if (xyMatch) {
        map[`${xyMatch[1]}-Mega-${xyMatch[2]}`] = megaName
      } else {
        map[`${suffix}-Mega`] = megaName
      }
    }
  }
  map['Meowstic-M-Mega'] = 'Mega Meowstic'
  return map
})()

const CC_FORME_NAME_MAP: Record<string, string> = {
  'Lycanroc': 'Lycanroc-Midday',
  'Gourgeist': 'Gourgeist-Average',
}

function normalizeCCName(name: string): string {
  return CC_MEGA_NAME_MAP[name] ?? CC_FORME_NAME_MAP[name] ?? name
}

export function useSpeedTiers() {
  const [data, setData] = useState<SpeedTierEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const res = await fetch('/api/cc/speed-tiers')
        if (!res.ok) throw new Error('Failed to fetch speed tiers')
        const json = await res.json()
        const rows: SpeedTierEntry[] = json.rows ?? []
        const normalized = rows.map(r => ({
          ...r,
          pokemon: { ...r.pokemon, name: normalizeCCName(r.pokemon.name) },
        }))
        setData(normalized)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}
