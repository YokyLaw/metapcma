export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await fetch(`https://www.coupcritique.fr/api/moves/pokemon/${encodeURIComponent(id)}`)
  const data = await res.json()
  return Response.json(data)
}
