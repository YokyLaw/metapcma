import type { TeamSlot } from '../types'
import { MEGA_MAP } from '../data/megaMap'
import { ABILITY_MAP } from '../data/abilityData'

export function getMegaOptions(baseName: string): Record<string, string> | null {
  return MEGA_MAP[baseName] || null
}

export function getEffectivePokeName(slot: TeamSlot): string {
  return slot.megaForme || slot.pokemon
}

export function getAbilitiesFor(effectiveName: string): string[] | null {
  return ABILITY_MAP[effectiveName] || null
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

export function spriteUrl(name: string): string {
  const slug = name.toLowerCase()
  const megaMatch = slug.match(/^mega (.+)$/)
  if (megaMatch) {
    const parts = megaMatch[1].split(' ')
    const last = parts[parts.length - 1]
    const isSingleLetter = parts.length > 1 && last.length === 1
    const base = isSingleLetter ? parts.slice(0, -1).join('-') : parts.join('-')
    const variant = isSingleLetter ? `-${last}` : ''
    return `https://www.coupcritique.fr/images/pokemons/sprites/${base}-mega${variant}.png`
  }
  return `https://www.coupcritique.fr/images/pokemons/sprites/${slug.replace(/ /g, '-')}.png`
}
