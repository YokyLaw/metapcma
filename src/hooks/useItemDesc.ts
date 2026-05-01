interface CCItem { name: string; description: string }

let cache: Record<string, string> | null = null
let fetchPromise: Promise<void> | null = null

export function prefetchItemDescs(): Promise<void> {
  if (cache || fetchPromise) return fetchPromise ?? Promise.resolve()
  fetchPromise = fetch('/api/cc/items')
    .then(r => r.json())
    .then((data: { items?: CCItem[] }) => {
      cache = {}
      for (const item of data.items ?? []) {
        if (item.name && item.description) cache[item.name] = item.description
      }
    })
    .catch(() => { cache = {} })
  return fetchPromise
}

export function getItemDesc(name: string): string | undefined {
  return cache?.[name]
}
