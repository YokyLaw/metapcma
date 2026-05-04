import { MEGA_MAP } from '../data/megaMap'
import { ITEM_DATA } from '../data/itemData'

interface CCItem { name: string; description: string }

const STONE_TO_POKE: Record<string, string> = {}
for (const megas of Object.values(MEGA_MAP)) {
  for (const [megaForme, stone] of Object.entries(megas)) {
    STONE_TO_POKE[stone] = megaForme
  }
}

const ITEM_DATA_SET = new Set(ITEM_DATA)
export const ITEM_LIST: string[] = [
  ...ITEM_DATA,
  ...Object.keys(STONE_TO_POKE).filter(s => !ITEM_DATA_SET.has(s)),
]

let cache: Record<string, string> | null = null
let fetchPromise: Promise<void> | null = null

export function prefetchItemDescs(): Promise<void> {
  if (cache || fetchPromise) return fetchPromise ?? Promise.resolve()
  fetchPromise = fetch('/api/cc/items')
    .then(r => r.json())
    .then((data: { items?: CCItem[] }) => {
      cache = {}
      for (const item of data.items ?? []) {
        if (!item.name || !item.description || item.description.startsWith('Indisponible')) continue
        cache[item.name] = item.description
      }
    })
    .catch(() => { cache = {} })
  return fetchPromise
}

export function getItemList(): string[] {
  return ITEM_LIST
}

export function getItemDesc(name: string): string | undefined {
  if (STONE_TO_POKE[name]) return STONE_TO_POKE[name]
  return cache?.[name]
}
