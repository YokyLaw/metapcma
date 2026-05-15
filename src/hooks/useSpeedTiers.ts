import { useState, useEffect } from 'react'

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
        setData(rows)
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
