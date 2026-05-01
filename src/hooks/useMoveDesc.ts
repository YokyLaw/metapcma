let cache: Record<string, string> | null = null
let fetchPromise: Promise<void> | null = null

export function prefetchMoveDescs(): Promise<void> {
  if (cache || fetchPromise) return fetchPromise ?? Promise.resolve()
  fetchPromise = fetch('/api/cc/moves-descs')
    .then(r => r.json())
    .then((data: Record<string, string>) => { cache = data })
    .catch(() => { cache = {} })
  return fetchPromise
}

export function getMoveDesc(name: string): string | undefined {
  return cache?.[name]
}
