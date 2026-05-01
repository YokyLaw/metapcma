export interface MoveMeta { category: string; type: string; bp: number }

let cache: Record<string, MoveMeta> | null = null
let fetchPromise: Promise<void> | null = null

export function prefetchMoveIndex(): Promise<void> {
  if (cache || fetchPromise) return fetchPromise ?? Promise.resolve()
  fetchPromise = fetch('/api/cc/moves-index')
    .then(r => r.json())
    .then((data: Record<string, MoveMeta>) => { cache = data })
    .catch(() => { cache = {} })
  return fetchPromise
}

export function getMoveMeta(name: string): MoveMeta | undefined {
  return cache?.[name]
}
