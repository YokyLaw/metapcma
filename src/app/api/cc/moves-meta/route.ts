export const revalidate = 86400

interface ListMove { id: number; name: string; category: string; power: number; type: { name: string } }
interface PerMove { move?: { priority?: number; flags?: { is_bullet?: boolean; is_bite?: boolean }; description?: string } }

export interface MoveMetaEntry {
  category: string
  type: string
  bp: number
  isPriority: boolean
  isBullet: boolean
  isBite: boolean
  desc?: string
}

export async function GET() {
  const listRes = await fetch('https://www.coupcritique.fr/api/moves', { next: { revalidate: 86400 } })
  const listData: { moves?: ListMove[] } = await listRes.json()
  const moves = listData.moves ?? []

  const result: Record<string, MoveMetaEntry> = {}
  for (const m of moves) {
    if (m.name) result[m.name] = { category: m.category, type: m.type?.name ?? '', bp: m.power ?? 0, isPriority: false, isBullet: false, isBite: false }
  }

  const BATCH = 60
  for (let i = 0; i < moves.length; i += BATCH) {
    await Promise.all(moves.slice(i, i + BATCH).map(m =>
      fetch(`https://www.coupcritique.fr/api/moves/${m.id}`, { next: { revalidate: 86400 } })
        .then(r => r.json() as Promise<PerMove>)
        .then(d => {
          const entry = result[m.name]
          if (!entry) return
          const mv = d.move
          if (!mv) return
          if (mv.priority && mv.priority !== 0) entry.isPriority = true
          if (mv.flags?.is_bullet) entry.isBullet = true
          if (mv.flags?.is_bite) entry.isBite = true
          const desc = mv.description?.trim()
          if (desc) entry.desc = desc
        })
        .catch(() => {})
    ))
  }

  return Response.json(result)
}
