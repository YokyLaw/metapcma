import { getMoveData } from './moveHelpers'
import type { MoveSlotResult } from '../types'

export type ThreatBucket = '' | 'green' | 'red'

export interface ThreatDefMove {
  name: string
  calc: { minPct: number; maxPct: number } | null
  immune?: boolean
}

export interface ThreatInput {
  defMoves: ThreatDefMove[]
  userSlots: (MoveSlotResult | null)[]
  atkSpeed: number | null
  advSpeed: number | null
  userHP: number
  advHP: number
  weather: string
  trickRoom: boolean
}

const RECHARGE_MOVES = new Set([
  'Hyper Beam', 'Giga Impact', 'Frenzy Plant', 'Blast Burn', 'Hydro Cannon',
  'Eternabeam', 'Meteor Assault', 'Roar of Time', 'Prismatic Laser', 'Rock Wrecker',
])
const CHARGE_MOVES = new Set([
  'Solar Beam', 'Solar Blade', 'Razor Wind', 'Sky Attack', 'Skull Bash',
  'Freeze Shock', 'Ice Burn', 'Geomancy', 'Bounce', 'Fly', 'Dig', 'Dive',
  'Phantom Force', 'Shadow Force', 'Electro Shot', 'Meteor Beam',
])

function chargeBypass(move: string, weather: string): boolean {
  if ((move === 'Solar Beam' || move === 'Solar Blade') && weather === 'Sun') return true
  if (move === 'Electro Shot' && weather === 'Rain') return true
  return false
}

type MInfo = {
  name: string; minPct: number; maxPct: number
  isPriority: boolean; isFakeOut: boolean
  isCharge: boolean; isRecharge: boolean
  recoilFactor: number
}

type Choice = {
  dmg: number; isPriority: boolean; isFakeOut: boolean
  isCharge: boolean; isRecharge: boolean; recoilFactor: number
}

function buildInfos(
  items: { name?: string; move?: string; calc: { minPct: number; maxPct: number } | null; immune?: boolean }[],
  attackerHP: number,
  defenderHP: number,
  weather: string,
): MInfo[] {
  return items
    .filter(m => m.calc && !m.immune)
    .map(m => {
      const name = (m.name ?? m.move ?? '') as string
      const md = getMoveData(name)
      const recoil = md?.recoilHP as [number, number] | undefined
      const recoilFactor = recoil && recoil[1] > 0
        ? (defenderHP / attackerHP) * (recoil[0] / recoil[1])
        : 0
      return {
        name,
        minPct: m.calc!.minPct,
        maxPct: m.calc!.maxPct,
        isPriority: !!md?.isPriority,
        isFakeOut: name === 'Fake Out',
        isCharge: CHARGE_MOVES.has(name) && !chargeBypass(name, weather),
        isRecharge: RECHARGE_MOVES.has(name),
        recoilFactor,
      }
    })
}

function chooseMove(infos: MInfo[], remaining: number, foAvailable: boolean): Choice | null {
  if (infos.length === 0) return null
  const pack = (m: MInfo, dmg: number, isPrio: boolean, isFO: boolean): Choice => ({
    dmg, isPriority: isPrio, isFakeOut: isFO, isCharge: m.isCharge, isRecharge: m.isRecharge, recoilFactor: m.recoilFactor,
  })
  if (foAvailable) {
    const fo = infos.find(m => m.isFakeOut)
    if (fo) return pack(fo, fo.minPct, true, true)
  }
  const usable = infos.filter(m => !m.isFakeOut)
  if (usable.length === 0) return null
  const prioKills = usable.filter(m => m.isPriority && m.minPct >= remaining)
  if (prioKills.length > 0) {
    const best = prioKills.reduce((a, b) => (b.minPct > a.minPct ? b : a))
    return pack(best, best.minPct, true, false)
  }
  const best = usable.reduce((a, b) => (b.maxPct > a.maxPct ? b : a))
  if (best.recoilFactor > 0 && best.minPct < remaining) {
    const nonRecoil = usable.filter(m => m.recoilFactor === 0)
    if (nonRecoil.length > 0) {
      const alt = nonRecoil.reduce((a, b) => (b.maxPct > a.maxPct ? b : a))
      return pack(alt, alt.minPct, alt.isPriority, false)
    }
  }
  return pack(best, best.minPct, best.isPriority, false)
}

export function calcThreatBucket(input: ThreatInput): ThreatBucket {
  const { defMoves, userSlots, atkSpeed, advSpeed, userHP, advHP, weather, trickRoom } = input

  if (atkSpeed === null || advSpeed === null) return ''
  if (userHP <= 0 || advHP <= 0) return ''

  const advInfos = buildInfos(defMoves, advHP, userHP, weather)
  const userInfos = buildInfos(
    userSlots.filter((s): s is MoveSlotResult => !!s).map(s => ({ name: s.move, calc: s.calc, immune: s.immune })),
    userHP,
    advHP,
    weather,
  )

  if (advInfos.length === 0) return 'green'

  const speedAdvFirst = atkSpeed === advSpeed ? true : (trickRoom ? atkSpeed > advSpeed : atkSpeed < advSpeed)
  let dmgOnUser = 0, dmgOnAdv = 0
  let advKOTurn: number | null = null
  let userKOTurn: number | null = null
  let advRechargeNext = false, userRechargeNext = false
  let advCharging: Choice | null = null, userCharging: Choice | null = null

  const recordAdvHit = (turn: number) => {
    if (advKOTurn === null && dmgOnUser >= 100) advKOTurn = turn
    if (userKOTurn === null && dmgOnAdv >= 100) userKOTurn = turn
  }
  const recordUserHit = (turn: number) => {
    if (userKOTurn === null && dmgOnAdv >= 100) userKOTurn = turn
    if (advKOTurn === null && dmgOnUser >= 100) advKOTurn = turn
  }

  type SideAction = { kind: 'attack'; choice: Choice } | { kind: 'charge'; choice: Choice } | { kind: 'recharge' } | { kind: 'none' }
  const planSide = (
    infos: MInfo[],
    remaining: number,
    foAvailable: boolean,
    rechargeNext: boolean,
    charging: Choice | null,
  ): SideAction => {
    if (rechargeNext) return { kind: 'recharge' }
    if (charging) return { kind: 'attack', choice: charging }
    const c = chooseMove(infos, remaining, foAvailable)
    if (!c) return { kind: 'none' }
    if (c.isCharge) return { kind: 'charge', choice: c }
    return { kind: 'attack', choice: c }
  }

  for (let turn = 1; turn <= 6; turn++) {
    if (advKOTurn !== null && userKOTurn !== null) break

    const advFOAvail = turn === 1 && !advCharging && !advRechargeNext
    const userFOAvail = turn === 1 && !userCharging && !userRechargeNext
    const advAction = planSide(advInfos, 100 - dmgOnUser, advFOAvail, advRechargeNext, advCharging)
    const userAction = planSide(userInfos, 100 - dmgOnAdv, userFOAvail, userRechargeNext, userCharging)

    advRechargeNext = false
    userRechargeNext = false
    if (advAction.kind === 'attack' && advCharging) advCharging = null
    if (userAction.kind === 'attack' && userCharging) userCharging = null
    if (advAction.kind === 'charge') advCharging = advAction.choice
    if (userAction.kind === 'charge') userCharging = userAction.choice

    if (advAction.kind === 'none' && userAction.kind === 'none') break

    const advAttack = advAction.kind === 'attack' ? advAction.choice : null
    const userAttack = userAction.kind === 'attack' ? userAction.choice : null

    let advFirst: boolean
    if (!userAttack) advFirst = true
    else if (!advAttack) advFirst = false
    else if (advAttack.isFakeOut && !userAttack.isFakeOut) advFirst = true
    else if (userAttack.isFakeOut && !advAttack.isFakeOut) advFirst = false
    else if (advAttack.isPriority && !userAttack.isPriority) advFirst = true
    else if (userAttack.isPriority && !advAttack.isPriority) advFirst = false
    else advFirst = speedAdvFirst

    const fireAdv = () => {
      if (!advAttack) return
      dmgOnUser += advAttack.dmg
      dmgOnAdv += advAttack.dmg * advAttack.recoilFactor
      recordAdvHit(turn)
      if (advAttack.isRecharge) advRechargeNext = true
    }
    const fireUser = () => {
      if (!userAttack) return
      dmgOnAdv += userAttack.dmg
      dmgOnUser += userAttack.dmg * userAttack.recoilFactor
      recordUserHit(turn)
      if (userAttack.isRecharge) userRechargeNext = true
    }

    if (advFirst) {
      fireAdv()
      if (advAttack?.isFakeOut) continue
      if (advKOTurn === null) fireUser()
    } else {
      fireUser()
      if (userAttack?.isFakeOut) continue
      if (userKOTurn === null) fireAdv()
    }
  }

  if (advKOTurn === null && userKOTurn === null) return ''
  if (userKOTurn !== null && advKOTurn === null) return 'green'
  if (advKOTurn !== null && userKOTurn === null) return advKOTurn <= 2 ? 'red' : ''
  if (advKOTurn! < userKOTurn!) return advKOTurn! <= 2 ? 'red' : ''
  if (userKOTurn! < advKOTurn!) return 'green'
  return ''
}
