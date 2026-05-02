import { NATURE_DATA } from '../data/constants'

export function buildShowdownText(
  pokeName: string,
  ability: string,
  item: string,
  natPlus: string,
  natMinus: string,
  sps: Record<string, number>,
  moves: string[]
): string {
  const natureName = Object.entries(NATURE_DATA).find(
    ([, [p, m]]) => p === natPlus && m === natMinus
  )?.[0] ?? 'Hardy'

  const evParts = [
    sps.hp ? `${sps.hp * 4} HP`  : '',
    sps.at ? `${sps.at * 4} Atk` : '',
    sps.df ? `${sps.df * 4} Def` : '',
    sps.sa ? `${sps.sa * 4} SpA` : '',
    sps.sd ? `${sps.sd * 4} SpD` : '',
    sps.sp ? `${sps.sp * 4} Spe` : '',
  ].filter(Boolean).join(' / ')

  const itemStr = item && item !== '(No Item)' ? ` @ ${item}` : ''
  const lines = [
    `${pokeName}${itemStr}`,
    ability ? `Ability: ${ability}` : '',
    evParts  ? `EVs: ${evParts}`    : '',
    `${natureName} Nature`,
    ...moves.filter(Boolean).map(m => `- ${m}`),
  ].filter(Boolean)
  return lines.join('\n')
}
