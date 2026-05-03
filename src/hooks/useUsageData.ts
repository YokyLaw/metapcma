import { useState, useEffect } from 'react'

export const USAGE_THRESHOLD = 0.8

let cache: Record<string, number> | null = null
let listeners: Array<() => void> = []
let fetchPromise: Promise<void> | null = null

export function prefetchUsageData(): Promise<void> {
  if (cache !== null || fetchPromise) return fetchPromise ?? Promise.resolve()
  fetchPromise = fetch('/api/cc/usage')
    .then(r => r.json())
    .then((data: Record<string, number>) => {
      cache = data
      listeners.forEach(fn => fn())
    })
    .catch(() => { cache = {} })
  return fetchPromise
}

export function getUsage(name: string): number {
  return cache?.[name] ?? -1
}

export function useUsageLoaded(): boolean {
  const [loaded, setLoaded] = useState(cache !== null)
  useEffect(() => {
    if (cache !== null) { setLoaded(true); return }
    const notify = () => setLoaded(true)
    listeners.push(notify)
    return () => { listeners = listeners.filter(fn => fn !== notify) }
  }, [])
  return loaded
}
