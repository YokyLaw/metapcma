interface CCAbility { name: string; description: string }

let cache: Record<string, string> | null = null
let fetchPromise: Promise<void> | null = null

export function prefetchAbilityDescs(): Promise<void> {
  if (cache || fetchPromise) return fetchPromise ?? Promise.resolve()
  fetchPromise = fetch('/api/cc/abilities')
    .then(r => r.json())
    .then((data: { abilities?: CCAbility[] }) => {
      cache = {}
      for (const ab of data.abilities ?? []) {
        if (ab.name && ab.description) cache[ab.name] = ab.description
      }
    })
    .catch(() => { cache = {} })
  return fetchPromise
}

export function getAbilityDesc(name: string): string | undefined {
  return cache?.[name]
}
