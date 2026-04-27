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
