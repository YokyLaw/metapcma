export const revalidate = 86400

export async function GET() {
  const listRes = await fetch('https://www.coupcritique.fr/api/moves', { next: { revalidate: 86400 } })
  const listData: { moves?: Array<{ id: number; name: string }> } = await listRes.json()
  const moves = listData.moves ?? []

  const result: Record<string, string> = {}
  const BATCH = 60

  for (let i = 0; i < moves.length; i += BATCH) {
    const batch = moves.slice(i, i + BATCH)
    await Promise.all(batch.map(m =>
      fetch(`https://www.coupcritique.fr/api/moves/${m.id}`, { next: { revalidate: 86400 } })
        .then(r => r.json())
        .then((d: { move?: { description?: string } }) => {
          const desc = d.move?.description?.trim()
          if (desc) result[m.name] = desc
        })
        .catch(() => {})
    ))
  }

  return Response.json(result)
}
