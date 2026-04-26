import type { TeamSlot } from '../types'
import { MEGA_MAP } from '../data/megaMap'
import { ABILITY_MAP } from '../data/abilityData'
import { CC_IDS } from '../data/usageData'

export function getMegaOptions(baseName: string): Record<string, string> | null {
  return MEGA_MAP[baseName] || null
}

export function getEffectivePokeName(slot: TeamSlot): string {
  return slot.megaForme || slot.pokemon
}

export function getAbilitiesFor(effectiveName: string): string[] | null {
  return ABILITY_MAP[effectiveName] || null
}

export function getCCId(pokeName: string): number | null {
  let baseName = pokeName
  if (pokeName && pokeName.startsWith('Mega ')) {
    for (const k in MEGA_MAP) {
      if (MEGA_MAP[k][pokeName] !== undefined) { baseName = k; break }
    }
  }
  return CC_IDS[baseName] || CC_IDS[pokeName] || null
}
