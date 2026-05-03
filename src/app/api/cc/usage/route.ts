import { POKE_DATA } from '../../../../data/pokeData'
import { MEGA_MAP } from '../../../../data/megaMap'

interface CCUsageEntry {
  provider: string
  percent?: number
  usageItems?: Array<{ item?: { name?: string }; percent?: number }>
}
interface CCPokemonResponse {
  usages?: CCUsageEntry[]
  pokemon?: { usages?: CCUsageEntry[] }
}

export const revalidate = 86400

export async function GET() {
  const baseNames = Object.keys(POKE_DATA).filter(n => !n.startsWith('Mega '))
  const result: Record<string, number> = {}
  const BATCH = 20

  for (let i = 0; i < baseNames.length; i += BATCH) {
    await Promise.all(
      baseNames.slice(i, i + BATCH).map(async name => {
        try {
          const res = await fetch(
            `https://www.coupcritique.fr/api/pokemon-name/${encodeURIComponent(name)}`,
            { next: { revalidate: 86400 } }
          )
          const data: CCPokemonResponse = await res.json()
          const usages = data.usages ?? data.pokemon?.usages ?? []
          const ch = usages.find(u => u.provider === 'champions')
          if (!ch?.percent) return

          result[name] = ch.percent

          const megas = MEGA_MAP[name]
          if (!megas) return
          for (const [megaName, stone] of Object.entries(megas)) {
            const stoneEntry = ch.usageItems?.find(it => it.item?.name === stone)
            if (stoneEntry?.percent) {
              result[megaName] = ch.percent * stoneEntry.percent / 100
            }
          }
        } catch { /* ignore individual failures */ }
      })
    )
  }

  return Response.json(result)
}
