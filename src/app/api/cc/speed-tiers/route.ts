import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Regulation MA (id 72 sur Coup Critique d'après la structure de l'URL fournie)
    const response = await fetch('https://www.coupcritique.fr/api/tiers/220/speed-tiers', {
      next: { revalidate: 86400 } // Cache 24h
    })
    
    if (!response.ok) {
      throw new Error(`CC API responded with status: ${response.status}`)
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Speed Tier API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch speed tiers' }, { status: 500 })
  }
}
