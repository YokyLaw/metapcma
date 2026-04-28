import type { TeamSlot, PokeEntry, StatMap, AdvOverride, TableRow, MoveSlotResult } from '../types'
import { POKE_DATA } from '../data/pokeData'
import { MOVE_DATA } from '../data/moveData'
import { TYPE_EFF } from '../data/typeEff'
import { ITEM_TYPE_BOOST } from '../data/itemData'
import { STAT_BOOST_MULTS } from '../data/constants'
import { pokeRound, calcHP, calcStat } from './statCalc'
import { getEffectivePokeName } from './teamHelpers'

export function getTypeEff(moveType: string, defType1: string, defType2?: string): number {
  const chart = TYPE_EFF[moveType] || {}
  let eff = 1
  if (defType1) eff *= (chart[defType1] !== undefined ? chart[defType1] : 1)
  if (defType2) eff *= (chart[defType2] !== undefined ? chart[defType2] : 1)
  return eff
}

export function calcDamage(atkStat: number, defStat: number, bp: number, level = 50): number {
  return Math.floor(Math.floor(Math.floor(2 * level / 5 + 2) * bp * atkStat / defStat / 50) + 2)
}

export function getWeatherMod(moveType: string, weather: string, item: string): number {
  if (item === 'Utility Umbrella') return 1.0
  if (weather === 'Sun'  && moveType === 'Fire')  return 1.5
  if (weather === 'Sun'  && moveType === 'Water') return 0.5
  if (weather === 'Rain' && moveType === 'Water') return 1.5
  if (weather === 'Rain' && moveType === 'Fire')  return 0.5
  return 1.0
}

export function getTerrainMod(moveType: string, terrain: string, isGroundedPoke: boolean): number {
  if (!isGroundedPoke) return 1.0
  const TERRAIN_BOOST = 1.3
  if ((terrain === 'Electric' && moveType === 'Electric') ||
      (terrain === 'Grassy'   && moveType === 'Grass') ||
      (terrain === 'Psychic'  && moveType === 'Psychic')) return TERRAIN_BOOST
  return 1.0
}

export function getSTAB(moveType: string, t1: string, t2: string, ability: string): number {
  if (moveType === t1 || moveType === t2) {
    return ability === 'Adaptability' ? 2.0 : 1.5
  }
  return 1.0
}

function getItemBPMod(item: string, moveType: string): number {
  if (ITEM_TYPE_BOOST[item] === moveType) return 1.2
  return 1.0
}

function isGrounded(defT1: string, defT2: string, defAbility: string): boolean {
  if (defT1 === 'Flying' || defT2 === 'Flying') return false
  if (defAbility === 'Levitate' || defAbility === 'Earth Eater') return false
  return true
}

interface CalcResult {
  moveName: string
  moveType: string
  moveCat: string
  minPct: number
  maxPct: number
  typeEff: number
  defHP: number
}

interface CalcCtx {
  defHP: number; defDfOv: number; defSdOv: number
  defenderData: PokeEntry
  atkPokeData: PokeEntry
  atkItem: string; atkAbility: string; defAbility: string
  defIsGrounded: boolean
  atkT1: string; atkT2: string; defT1: string; defT2: string
  defW: number; atkW: number
  attacker: TeamSlot; atkStats: StatMap
  weather: string; terrain: string
}

function buildCalcCtx(
  attacker: TeamSlot,
  atkStats: StatMap,
  defenderData: PokeEntry,
  overrideStats: Partial<AdvOverride> | null,
  weather: string,
  terrain: string
): CalcCtx | null {
  const defNatArr: [string, string] = overrideStats
    ? [overrideStats.natPlus || '', overrideStats.natMinus || '']
    : ['', '']
  const spHP = overrideStats?.sp_hp ?? 0
  const spDf = overrideStats?.sp_df ?? 0
  const spSd = overrideStats?.sp_sd ?? 0

  const defHP   = calcHP(defenderData.bs.hp, spHP)
  const defDfOv = calcStat(defenderData.bs.df, spDf, defNatArr, 'df')
  const defSdOv = calcStat(defenderData.bs.sd, spSd, defNatArr, 'sd')

  const atkPokeData = POKE_DATA[getEffectivePokeName(attacker)]
  if (!atkPokeData) return null

  const atkItem    = attacker.item || ''
  const atkAbility = attacker.ability || (atkPokeData.ab as string) || ''
  const defAbility = overrideStats?.ability || (defenderData.ab as string) || ''
  const defIsGrounded = isGrounded(defenderData.t1, defenderData.t2 || '', defAbility)
  const atkT1 = atkPokeData.t1, atkT2 = atkPokeData.t2 || ''
  const defT1 = defenderData.t1, defT2 = defenderData.t2 || ''
  const defW = defenderData.w || 0
  const atkW = atkPokeData.w || 0

  return {
    defHP, defDfOv, defSdOv, defenderData,
    atkPokeData, atkItem, atkAbility, defAbility, defIsGrounded,
    atkT1, atkT2, defT1, defT2, defW, atkW,
    attacker, atkStats, weather, terrain,
  }
}

function calcOneMoveResult(moveName: string, ctx: CalcCtx): CalcResult | null {
  const {
    defHP, defDfOv, defSdOv, defenderData, atkPokeData,
    atkItem, atkAbility, defAbility, defIsGrounded,
    atkT1, atkT2, defT1, defT2, defW, atkW,
    attacker, atkStats, weather, terrain,
  } = ctx

  const md = MOVE_DATA[moveName]
  if (!md || !md.bp || md.bp <= 0) return null
  if (!md.category || md.category === 'Status') return null

  let bp = md.bp
  let moveCat = md.category as string
  let moveType = md.type

  // TYPE CHANGES
  if (moveName === 'Weather Ball') {
    if      (weather === 'Sun')  { moveType = 'Fire';  bp = 100 }
    else if (weather === 'Rain') { moveType = 'Water'; bp = 100 }
    else if (weather === 'Sand') { moveType = 'Rock';  bp = 100 }
    else if (weather === 'Snow') { moveType = 'Ice';   bp = 100 }
  }
  if (moveName === 'Terrain Pulse') {
    if      (terrain === 'Electric') { moveType = 'Electric'; bp = 100 }
    else if (terrain === 'Grassy')   { moveType = 'Grass';    bp = 100 }
    else if (terrain === 'Misty')    { moveType = 'Fairy';    bp = 100 }
    else if (terrain === 'Psychic')  { moveType = 'Psychic';  bp = 100 }
  }
  const ateTypes: Record<string, string> = { 'Galvanize':'Electric', 'Aerilate':'Flying', 'Pixilate':'Fairy', 'Refrigerate':'Ice' }
  let ateBoost = false
  if (ateTypes[atkAbility] && moveType === 'Normal') { moveType = ateTypes[atkAbility]; ateBoost = true }

  // BP VARIABLES
  if (moveName === 'Low Kick' || moveName === 'Grass Knot') {
    bp = defW >= 200 ? 120 : defW >= 100 ? 100 : defW >= 50 ? 80 : defW >= 25 ? 60 : defW >= 10 ? 40 : 20
  } else if (moveName === 'Heavy Slam' || moveName === 'Heat Crash') {
    const ratio = defW > 0 ? atkW / defW : 5
    bp = ratio >= 5 ? 120 : ratio >= 4 ? 100 : ratio >= 3 ? 80 : ratio >= 2 ? 60 : 40
  } else if (moveName === 'Gyro Ball') {
    bp = Math.min(150, Math.max(1, Math.floor(25 * (defenderData.bs.sp || 1) / (atkPokeData.bs.sp || 1))))
  } else if (moveName === 'Electro Ball') {
    const spRatio = Math.floor((atkPokeData.bs.sp || 1) / (defenderData.bs.sp || 1))
    bp = spRatio >= 4 ? 150 : spRatio >= 3 ? 120 : spRatio >= 2 ? 80 : spRatio >= 1 ? 60 : 40
  } else if (moveName === 'Acrobatics') {
    bp = (atkItem === '' || atkItem === '(No Item)') ? 110 : 55
  } else if (moveName === 'Knock Off') {
    bp = 97
  } else if (moveName === 'Body Press') {
    moveCat = 'BodyPress'
  } else if (moveName === 'Psyshock' || moveName === 'Psystrike' || moveName === 'Secret Sword') {
    moveCat = 'PsyshockType'
  } else if (moveName === 'Foul Play') {
    return null
  } else if (bp <= 1) {
    return null
  }

  // Context-dependent BP
  if (moveName === 'Rising Voltage'  && terrain === 'Electric' && defIsGrounded) bp *= 2
  if (moveName === 'Expanding Force' && terrain === 'Psychic')  bp = Math.floor(bp * 1.5)
  if (moveName === 'Psyblade'        && terrain === 'Electric') bp = Math.floor(bp * 1.5)
  if ((moveName === 'Solar Beam' || moveName === 'Solar Blade') && weather !== 'Sun' && weather !== '') bp = Math.floor(bp / 2)

  // BP MODIFIERS
  let bpMult = 1.0
  if (ateBoost)                                                              bpMult *= 1.2
  if (atkAbility === 'Reckless'    && (md.hasRecoil || md.hasCrash))        bpMult *= 1.2
  if (atkAbility === 'Iron Fist'   && md.isPunch)                           bpMult *= 1.2
  if (atkAbility === 'Punk Rock'   && md.isSound)                           bpMult *= 1.3
  if (atkAbility === 'Sheer Force' && md.hasSecondaryEffect)                bpMult *= 1.3
  if (atkAbility === 'Sand Force'  && weather === 'Sand' && ['Rock','Ground','Steel'].includes(moveType)) bpMult *= 1.3
  if (atkAbility === 'Tough Claws' && md.makesContact)                      bpMult *= 1.3

  let techBP = bp * bpMult
  if (atkAbility === 'Technician'    && techBP <= 60)            techBP *= 1.5
  if (atkAbility === 'Strong Jaw'    && md.isBite)               techBP *= 1.5
  if (atkAbility === 'Mega Launcher' && md.isPulse)              techBP *= 1.5
  if (atkAbility === 'Steely Spirit' && moveType === 'Steel')    techBP *= 1.5
  if (atkAbility === 'Sharpness'     && md.isSlice)              techBP *= 1.5
  bp = Math.floor(techBP)

  const bpItemMod = getItemBPMod(atkItem, moveType)
  bp = Math.floor(bp * bpItemMod)
  if ((atkItem === 'Muscle Band' && moveCat === 'Physical') ||
      (atkItem === 'Wise Glasses' && moveCat === 'Special')) bp = Math.floor(bp * 1.1)

  // Terrain BP
  if      (moveType === 'Electric' && terrain === 'Electric') bp = Math.floor(bp * 1.3)
  else if (moveType === 'Grass'    && terrain === 'Grassy')   bp = Math.floor(bp * 1.3)
  else if (moveType === 'Psychic'  && terrain === 'Psychic')  bp = Math.floor(bp * 1.3)
  if (terrain === 'Misty'  && moveType === 'Dragon' && defIsGrounded) bp = Math.floor(bp * 0.5)
  if (terrain === 'Grassy' && (moveName === 'Earthquake' || moveName === 'Bulldoze')) bp = Math.floor(bp * 0.5)

  // STATS
  let atkStatRaw: number, defStatRaw: number
  if (moveCat === 'BodyPress') {
    atkStatRaw = atkStats.df; defStatRaw = defDfOv; moveCat = 'Physical'
  } else if (moveCat === 'PsyshockType') {
    atkStatRaw = atkStats.sa; defStatRaw = defDfOv; moveCat = 'Special'
  } else {
    atkStatRaw = moveCat === 'Physical' ? atkStats.at : atkStats.sa
    defStatRaw = moveCat === 'Physical' ? defDfOv : defSdOv
  }

  const atkBoostKey = moveCat === 'Physical' ? 'at' : 'sa'
  const atkBoostVal = attacker.boosts[atkBoostKey as keyof typeof attacker.boosts] || 0
  const boostStr = atkBoostVal > 0 ? '+' + atkBoostVal : '' + atkBoostVal
  const atkBoostMult = STAT_BOOST_MULTS[boostStr] || 1
  let atkStat = Math.floor(atkStatRaw * atkBoostMult)

  // ATTACK MODIFIERS
  let atkMod = 1.0
  if (atkItem === 'Choice Band'  && moveCat === 'Physical') atkMod *= 1.5
  if (atkItem === 'Choice Specs' && moveCat === 'Special')  atkMod *= 1.5
  if (atkItem === 'Life Orb')                               atkMod *= 1.3
  if ((atkAbility === 'Huge Power' || atkAbility === 'Pure Power') && moveCat === 'Physical') atkMod *= 2
  if (atkAbility === 'Water Bubble'  && moveType === 'Water')   atkMod *= 2
  if (atkAbility === "Dragon's Maw"  && moveType === 'Dragon')  atkMod *= 1.5
  if (atkAbility === 'Transistor'    && moveType === 'Electric') atkMod *= 1.3
  if (atkAbility === 'Solar Power'   && weather === 'Sun' && moveCat === 'Special') atkMod *= 1.5
  if (atkAbility === 'Flash Fire'    && moveType === 'Fire')     atkMod *= 1.5
  if (atkAbility === 'Hustle'        && moveCat === 'Physical')  atkStat = Math.floor(atkStat * 1.5)

  // DEFENSE MODIFIERS
  let defMod = 1.0
  if (defAbility === 'Thick Fat'      && (moveType === 'Fire' || moveType === 'Ice')) defMod *= 0.5
  if (defAbility === 'Water Bubble'   && moveType === 'Fire')  defMod *= 0.5
  if (defAbility === 'Purifying Salt' && moveType === 'Ghost') defMod *= 0.5
  if (defAbility === 'Heatproof'      && moveType === 'Fire')  defMod *= 0.5
  if (defAbility === 'Fur Coat'       && moveCat === 'Physical') defMod *= 0.5
  if (weather === 'Sand' && (defT1 === 'Rock' || defT2 === 'Rock') && moveCat === 'Special')  defMod *= (1/1.5)
  if (weather === 'Snow' && (defT1 === 'Ice'  || defT2 === 'Ice')  && moveCat === 'Physical') defMod *= (1/1.5)

  // ABILITY IMMUNITIES
  if (moveType === 'Ground'   && (defAbility === 'Levitate' || defAbility === 'Earth Eater')) return null
  if (moveType === 'Fire'     && (defAbility === 'Flash Fire' || defAbility === 'Well-Baked Body')) return null
  if (moveType === 'Water'    && (defAbility === 'Water Absorb' || defAbility === 'Storm Drain' || defAbility === 'Dry Skin')) return null
  if (moveType === 'Electric' && (defAbility === 'Volt Absorb' || defAbility === 'Motor Drive' || defAbility === 'Lightning Rod')) return null
  if (moveType === 'Grass'    && defAbility === 'Sap Sipper') return null
  if (md.isSound              && defAbility === 'Soundproof')  return null
  if (md.isBullet             && defAbility === 'Bulletproof') return null

  // TYPE EFFECTIVENESS
  const typeEff = getTypeEff(moveType, defT1, defT2)
  if (typeEff === 0) return null

  // Wonder Guard: only super-effective moves land
  if (defAbility === 'Wonder Guard' && typeEff <= 1) return null

  // FINAL MODS
  let finalMod = 1.0
  if ((defAbility === 'Filter' || defAbility === 'Solid Rock' || defAbility === 'Prism Armor') && typeEff > 1) finalMod *= 0.75
  if (defAbility === 'Multiscale' || defAbility === 'Shadow Shield') finalMod *= 0.5
  if (defAbility === 'Fluffy') {
    if (md.makesContact) finalMod *= 0.5
    if (moveType === 'Fire') finalMod *= 2
  }
  if (defAbility === 'Punk Rock' && md.isSound)             finalMod *= 0.5
  if (defAbility === 'Ice Scales' && moveCat === 'Special')  finalMod *= 0.5
  if (atkItem === 'Expert Belt' && typeEff > 1)              finalMod *= 1.2
  if (atkAbility === 'Tinted Lens' && typeEff < 1)           finalMod *= 2
  if (atkAbility === 'Neuroforce'  && typeEff > 1)           finalMod *= 1.25

  // STAB
  const stab = getSTAB(moveType, atkT1, atkT2, atkAbility)

  // DAMAGE
  const modifiedAtk = Math.floor(atkStat * atkMod)
  const modifiedDef = Math.floor(defStatRaw * defMod)
  let baseDmg = calcDamage(modifiedAtk, modifiedDef, bp)

  if (md.isSpread) baseDmg = Math.floor(baseDmg * 0.75)

  const weatherMod = getWeatherMod(moveType, weather, atkItem)
  if (weatherMod !== 1.0) {
    baseDmg = pokeRound(baseDmg * (weatherMod === 1.5 ? 0x1800 : 0x800) / 0x1000)
  }

  function applyMods(d: number): number {
    d = pokeRound(d * stab)
    d = Math.floor(d * typeEff)
    d = pokeRound(d * finalMod)
    return Math.max(1, d)
  }

  const minDmg = applyMods(Math.floor(baseDmg * 85 / 100))
  const maxDmg = applyMods(baseDmg)
  const minPct = (minDmg / defHP) * 100
  const maxPct = (maxDmg / defHP) * 100

  return { moveName, moveType, moveCat, minPct, maxPct, typeEff, defHP }
}

export function calcBestMove(
  attacker: TeamSlot,
  atkStats: StatMap,
  _defenderName: string,
  defenderData: PokeEntry,
  overrideStats: Partial<AdvOverride> | null,
  weather: string,
  terrain: string
): CalcResult | null {
  const ctx = buildCalcCtx(attacker, atkStats, defenderData, overrideStats, weather, terrain)
  if (!ctx) return null

  const selectedMoves = attacker.moves.filter(m => m && MOVE_DATA[m])
  if (selectedMoves.length === 0) return null

  let bestResult: CalcResult | null = null
  for (const moveName of selectedMoves) {
    const r = calcOneMoveResult(moveName, ctx)
    if (r && (!bestResult || r.maxPct > bestResult.maxPct)) bestResult = r
  }
  return bestResult
}

export function buildTableRow(
  attacker: TeamSlot,
  atkStats: StatMap,
  defName: string,
  defData: PokeEntry,
  advStats: Record<string, Partial<AdvOverride>>,
  weather: string,
  terrain: string,
  defaultAbility?: string
): TableRow | null {
  if (!attacker.moves.some(m => m)) return null

  const override = advStats[defName] || {}
  const effectiveOverride = defaultAbility && !override.ability
    ? { ...override, ability: defaultAbility }
    : override
  const ctx = buildCalcCtx(attacker, atkStats, defData, effectiveOverride, weather, terrain)
  if (!ctx) return null

  let bestResult: CalcResult | null = null

  const moveResults: (MoveSlotResult | null)[] = attacker.moves.map(moveName => {
    if (!moveName) return null
    const md = MOVE_DATA[moveName]
    const baseType = md?.type || 'Normal'

    if (!md || md.category === 'Status' || !md.bp || md.bp === 0) {
      return { move: moveName, moveType: baseType, calc: null }
    }

    const r = calcOneMoveResult(moveName, ctx)
    if (!r) return { move: moveName, moveType: baseType, calc: null }

    if (!bestResult || r.maxPct > bestResult.maxPct) bestResult = r

    return {
      move: moveName,
      moveType: r.moveType,
      calc: {
        minPct: r.minPct,
        maxPct: r.maxPct,
        isOHKO: r.minPct >= 100,
        isKO: r.maxPct >= 100 && r.minPct < 100,
      },
    }
  })

  const best = bestResult as CalcResult | null
  const sortMove    = best?.moveName ?? (attacker.moves.find(m => m) ?? '')
  const sortType    = best?.moveType ?? (MOVE_DATA[sortMove]?.type ?? 'Normal')
  const sortMinPct  = best?.minPct ?? 0
  const sortMaxPct  = best?.maxPct ?? 0

  return {
    name: defName,
    type1: defData.t1,
    type2: defData.t2 || '',
    usage: 0,
    defHP: ctx.defHP,
    move: sortMove,
    moveType: sortType,
    minPct: sortMinPct,
    maxPct: sortMaxPct,
    isOHKO: sortMinPct >= 100,
    isKO: sortMaxPct >= 100 && sortMinPct < 100,
    moveResults,
    defaultAbility: defaultAbility || undefined,
  }
}
