export async function GET() {
  const res = await fetch('https://www.coupcritique.fr/api/items', { next: { revalidate: 86400 } })
  const data = await res.json()
  return Response.json(data)
}
