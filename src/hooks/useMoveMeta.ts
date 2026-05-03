export interface MoveMeta {
  category: string
  type: string
  bp: number
  isPriority: boolean
  isBullet: boolean
  isBite: boolean
  desc?: string
}

let cache: Record<string, MoveMeta> | null = null
let fetchPromise: Promise<void> | null = null

export function prefetchMoveMeta(): Promise<void> {
  if (cache || fetchPromise) return fetchPromise ?? Promise.resolve()
  fetchPromise = fetch('/api/cc/moves-meta')
    .then(r => r.json())
    .then((data: Record<string, MoveMeta>) => { cache = data })
    .catch(() => { cache = {} })
  return fetchPromise
}

export function getMoveMeta(name: string): MoveMeta | undefined {
  return cache?.[name]
}

export function getMoveDesc(name: string): string | undefined {
  return cache?.[name]?.desc
}
