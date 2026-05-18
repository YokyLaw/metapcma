import type { TeamSlot } from '../types'
import { MEGA_MAP } from '../data/megaMap'

export function getMegaOptions(baseName: string): Record<string, string> | null {
  return MEGA_MAP[baseName] || null
}

export function getEffectivePokeName(slot: TeamSlot): string {
  return slot.megaForme || slot.pokemon
}

export function getPokeNameFromId(id: string): string {
  return id.replace(/#\d+$/, '')
}

export function getBaseNameForCC(pokeName: string): string {
  if (!pokeName) return pokeName
  if (pokeName.startsWith('Mega ')) {
    for (const k in MEGA_MAP) {
      if (MEGA_MAP[k][pokeName] !== undefined) return k
    }
  }
  return pokeName
}

export interface CCMoveEntry { move: { name: string }; percent: number }

export function itemSpriteUrl(name: string): string {
  const slug = name.toLowerCase().replace(/'/g, '').replace(/ /g, '-')
  return `https://www.coupcritique.fr/images/items/sprites/${slug}.png`
}

export function spriteUrl(name: string, shiny: boolean = false): string {
  const slug = name.toLowerCase()
  const megaMatch = slug.match(/^mega (.+)$/)
  let path: string
  if (megaMatch) {
    const parts = megaMatch[1].split(' ')
    const last = parts[parts.length - 1]
    const isSingleLetter = parts.length > 1 && last.length === 1
    const base = isSingleLetter ? parts.slice(0, -1).join('-') : parts.join('-')
    const variant = isSingleLetter ? `-${last}` : ''
    path = `${base}-mega${variant}`
  } else {
    path = slug.replace(/ /g, '-')
  }
  if (shiny) {
    return `https://play.pokemonshowdown.com/sprites/gen5-shiny/${path.replace(/['. :]/g, '')}.png`
  }
  return `https://www.coupcritique.fr/images/pokemons/sprites/${path}.png`
}

export function artworkUrl(name: string, shiny: boolean = false): string {
  if (!name) return ''
  let slug = name.toLowerCase()

  // Gestion spécifique des Méga-Évolutions pour Showdown
  // Format attendu: pokemon-mega, pokemon-megax, pokemon-megay
  if (slug.startsWith('mega ')) {
    const base = slug.replace('mega ', '')
    if (base.endsWith(' x')) {
      slug = base.replace(' x', '-megax')
    } else if (base.endsWith(' y')) {
      slug = base.replace(' y', '-megay')
    } else {
      slug = base + '-mega'
    }
  }

  // Nettoyage des caractères spéciaux restants
  slug = slug.replace(/ /g, '-').replace(/['. :]/g, '')

  const dir = shiny ? 'ani-shiny' : 'ani'
  return `https://play.pokemonshowdown.com/sprites/${dir}/${slug}.gif`
}

