import { NextResponse } from 'next/server'
import { POKE_DATA } from '../../../../data/pokeData'

const POOL_INTERNAL: string[] = [
  'Venusaur','Mega Venusaur','Charizard','Mega Charizard X','Mega Charizard Y','Blastoise','Mega Blastoise','Beedrill','Mega Beedrill','Pidgeot','Mega Pidgeot','Arbok','Pikachu','Raichu','Clefable','Mega Clefable','Ninetales','Arcanine','Alakazam','Mega Alakazam','Machamp','Victreebel','Mega Victreebel','Slowbro','Mega Slowbro','Gengar','Mega Gengar','Kangaskhan','Mega Kangaskhan','Starmie','Mega Starmie','Pinsir','Mega Pinsir','Tauros','Gyarados','Mega Gyarados','Ditto','Vaporeon','Jolteon','Flareon','Aerodactyl','Mega Aerodactyl','Snorlax','Dragonite','Mega Dragonite','Meganium','Mega Meganium','Typhlosion','Feraligatr','Mega Feraligatr','Ariados','Ampharos','Mega Ampharos','Azumarill','Politoed','Espeon','Umbreon','Slowking','Forretress','Steelix','Mega Steelix','Scizor','Mega Scizor','Heracross','Mega Heracross','Skarmory','Mega Skarmory','Houndoom','Mega Houndoom','Tyranitar','Mega Tyranitar','Pelipper','Gardevoir','Mega Gardevoir','Sableye','Mega Sableye','Aggron','Mega Aggron','Medicham','Mega Medicham','Manectric','Mega Manectric','Sharpedo','Mega Sharpedo','Camerupt','Mega Camerupt','Torkoal','Altaria','Mega Altaria','Milotic','Castform','Banette','Mega Banette','Chimecho','Mega Chimecho','Absol','Mega Absol','Glalie','Mega Glalie','Torterra','Infernape','Empoleon','Luxray','Roserade','Rampardos','Bastiodon','Lopunny','Mega Lopunny','Spiritomb','Garchomp','Mega Garchomp','Lucario','Mega Lucario','Hippowdon','Toxicroak','Abomasnow','Mega Abomasnow','Weavile','Rhyperior','Leafeon','Glaceon','Gliscor','Mamoswine','Gallade','Mega Gallade','Froslass','Mega Froslass','Rotom','Serperior','Emboar','Mega Emboar','Samurott','Liepard','Simisage','Simisear','Simipour','Excadrill','Mega Excadrill','Audino','Mega Audino','Conkeldurr','Whimsicott','Krookodile','Cofagrigus','Garbodor','Zoroark','Reuniclus','Vanilluxe','Emolga','Chandelure','Mega Chandelure','Beartic','Stunfisk','Golurk','Mega Golurk','Hydreigon','Volcarona','Chesnaught','Mega Chesnaught','Delphox','Mega Delphox','Greninja','Mega Greninja','Diggersby','Talonflame','Vivillon','Floette-Eternal','Mega Floette','Florges','Pangoro','Furfrou','Meowstic','Mega Meowstic','Aegislash','Aromatisse','Slurpuff','Clawitzer','Heliolisk','Tyrantrum','Aurorus','Sylveon','Hawlucha','Mega Hawlucha','Dedenne','Goodra','Klefki','Trevenant','Gourgeist-Average','Avalugg','Noivern','Decidueye','Incineroar','Primarina','Toucannon','Crabominable','Mega Crabominable','Lycanroc-Midday','Toxapex','Mudsdale','Araquanid','Salazzle','Tsareena','Oranguru','Passimian','Mimikyu','Drampa','Mega Drampa','Kommo-o','Corviknight','Flapple','Appletun','Sandaconda','Polteageist','Hatterene','Mr. Rime','Runerigus','Alcremie','Morpeko','Dragapult','Wyrdeer','Kleavor','Basculegion','Sneasler','Meowscarada','Skeledirge','Quaquaval','Maushold','Garganacl','Armarouge','Ceruledge','Bellibolt','Scovillain','Mega Scovillain','Espathra','Tinkaton','Palafin','Orthworm','Glimmora','Mega Glimmora','Farigiraf','Kingambit','Sinistcha','Archaludon','Hydrapple','Watchog',
]

function internalToCC(name: string): string {
  if (name.startsWith('Mega ')) {
    const suffix = name.slice(5)
    const xy = suffix.match(/^(.+) ([XY])$/)
    if (xy) return `${xy[1]}-Mega-${xy[2]}`
    if (suffix === 'Meowstic') return 'Meowstic-M-Mega'
    return `${suffix}-Mega`
  }
  if (name === 'Lycanroc-Midday') return 'Lycanroc'
  if (name === 'Gourgeist-Average') return 'Gourgeist'
  return name
}

function maxSpeedAt50(baseSpe: number): number {
  return Math.floor((baseSpe + 52) * 1.1)
}

export async function GET() {
  try {
    const [stRes, allPkRes] = await Promise.all([
      fetch('https://www.coupcritique.fr/api/tiers/220/speed-tiers', {
        next: { revalidate: 86400 },
      }),
      fetch('https://www.coupcritique.fr/api/pokemons', {
        next: { revalidate: 86400 },
      }),
    ])

    if (!stRes.ok) {
      throw new Error(`CC API responded with status: ${stRes.status}`)
    }

    const stData = await stRes.json()
    const rows: any[] = Array.isArray(stData.rows) ? [...stData.rows] : []
    const existing = new Set<string>(
      rows.map(r => r?.pokemon?.name).filter(Boolean) as string[]
    )

    const frMap: Record<string, string> = {}
    if (allPkRes.ok) {
      try {
        const allData = await allPkRes.json()
        for (const p of allData.pokemons ?? []) {
          if (p?.name && p?.nom) frMap[p.name] = p.nom
        }
      } catch { /* ignore */ }
    }

    for (const internal of POOL_INTERNAL) {
      const cc = internalToCC(internal)
      if (existing.has(cc)) continue
      const pd = (POKE_DATA as any)[internal]
      if (!pd) continue
      rows.push({
        pokemon: { name: cc, nom: frMap[cc] ?? cc },
        speed: maxSpeedAt50(pd.bs.sp),
        bonus: '',
        percent: 0,
        rank: null,
      })
      existing.add(cc)
    }

    rows.sort((a, b) => (b.speed ?? 0) - (a.speed ?? 0))

    return NextResponse.json({ ...stData, rows })
  } catch (error) {
    console.error('Speed Tier API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch speed tiers' }, { status: 500 })
  }
}
