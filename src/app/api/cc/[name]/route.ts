export const revalidate = 86400

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const res = await fetch(
    `https://www.coupcritique.fr/api/pokemon-name/${encodeURIComponent(name)}`,
    { next: { revalidate: 86400 } },
  )
  const data = await res.json()
  return Response.json(data)
}
