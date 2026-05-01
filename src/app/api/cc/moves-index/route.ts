export const revalidate = 86400

export async function GET() {
  const res = await fetch('https://www.coupcritique.fr/api/moves', { next: { revalidate: 86400 } })
  const data: { moves?: Array<{ name: string; category: string; power: number; type: { name: string } }> } = await res.json()
  const index: Record<string, { category: string; type: string; bp: number }> = {}
  for (const m of data.moves ?? []) {
    if (m.name) index[m.name] = { category: m.category, type: m.type?.name ?? '', bp: m.power ?? 0 }
  }
  return Response.json(index)
}
