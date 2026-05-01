import type { StatMap } from '../types'

// Official Pokémon rounding: strictly > 0.5 → ceil, otherwise → floor
export function pokeRound(n: number): number {
  return (n % 1 > 0.5) ? Math.ceil(n) : Math.floor(n)
}

export function calcHP(baseHP: number, sp: number): number {
  if (baseHP === 1) return 1
  return Math.floor((baseHP * 2 + 31) * 50 / 100) + 50 + 10 + sp
}

export function calcStat(base: number, sp: number, natureMods: [string, string], statKey: string): number {
  const plus  = natureMods[0] || ''
  const minus = natureMods[1] || ''
  const natureBonus = (plus && plus === minus) ? 1
                    : plus  === statKey ? 1.1
                    : minus === statKey ? 0.9
                    : 1
  return Math.floor((Math.floor((base * 2 + 31) * 50 / 100) + 5 + sp) * natureBonus)
}

export function getItemStatMult(item: string, statKey: string): number {
  if (item === 'Choice Scarf' && statKey === 'sp') return 1.5
  if (item === 'Choice Band'  && statKey === 'at') return 1.5
  if (item === 'Choice Specs' && statKey === 'sa') return 1.5
  if (item === 'Assault Vest' && statKey === 'sd') return 1.5
  return 1
}

export function getStats(
  pokeData: { bs: Record<string, number> },
  sps: StatMap,
  natPlus: string,
  natMinus: string
): StatMap {
  const nat: [string, string] = [natPlus || '', natMinus || '']
  const bs = pokeData.bs
  return {
    hp: calcHP(bs.hp, sps.hp),
    at: calcStat(bs.at, sps.at, nat, 'at'),
    df: calcStat(bs.df, sps.df, nat, 'df'),
    sa: calcStat(bs.sa, sps.sa, nat, 'sa'),
    sd: calcStat(bs.sd, sps.sd, nat, 'sd'),
    sp: calcStat(bs.sp, sps.sp, nat, 'sp'),
  }
}
