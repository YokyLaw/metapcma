import { useEffect, useState } from 'react'
import { useAppState } from '../../context/AppContext'
import { USAGE_MAP } from '../../data/usageData'
import { NATURE_STATS, NATURE_STAT_LABELS } from '../../data/constants'
import { spriteUrl, getEffectivePokeName } from '../../calc/teamHelpers'
import { POKE_DATA } from '../../data/pokeData'
import { MOVE_DATA } from '../../data/moveData'
import { calcStat, getStats } from '../../calc/statCalc'
import { buildCalcCtx, calcOneMoveResult } from '../../calc/damageCalc'
import type { TableRow, MoveSlotResult, TeamSlot } from '../../types'
import SearchSelect from '../TeamPanel/SearchSelect'
import type { SearchOption } from '../TeamPanel/SearchSelect'
import '../../styles/teamPanel.css'

interface CCAbility { ability: { name: string }; percent: number }
interface CCMove    { move: { name: string };    percent: number }

const advAbilityCache = new Map<string, CCAbility[]>()
const advMovesCache   = new Map<string, CCMove[]>()
const fetchingAdv     = new Set<string>()

interface Props {
  row: TableRow & {
    spHP?: number; spDf?: number; spSd?: number
    spSp?: number; spAt?: number; spSa?: number
    advNatPlus?: string; advNatMinus?: string; advAbility?: string
  }
}

function fmt(pct: number): string {
  return (Math.floor(pct * 10) / 10).toFixed(1)
}

function MoveSlotDiv({ slot }: { slot: MoveSlotResult | null }) {
  if (!slot) return <div className="adv-move-row"><span className="adv-moves-empty">—</span></div>

  const { calc } = slot
  const pctClass = calc?.isOHKO ? ' ohko' : calc && calc.minPct < 50 ? ' ko-low' : calc?.isKO ? ' ko' : ''

  return (
    <div className={'adv-move-row' + pctClass}>
      <span className="type-dot" style={{ background: `var(--${slot.moveType})` }} />
      <span className="adv-move-name">{slot.move}</span>
      {calc && (
        <span className="adv-move-pct">
          {fmt(calc.minPct)}%–{fmt(calc.maxPct)}%
        </span>
      )}
    </div>
  )
}

export default function DamageRow({ row }: Props) {
  const { state, dispatch } = useAppState()
  const [ccAbilities, setCCAbilities] = useState<CCAbility[]>(advAbilityCache.get(row.name) ?? [])
  const [ccMoves,     setCCMoves]     = useState<CCMove[]>(advMovesCache.get(row.name) ?? [])

  useEffect(() => {
    const cachedAb = advAbilityCache.get(row.name)
    const cachedMv = advMovesCache.get(row.name)
    if (cachedAb) setCCAbilities(cachedAb)
    if (cachedMv) setCCMoves(cachedMv)
    if ((cachedAb || cachedMv) && fetchingAdv.has(row.name)) return
    if (cachedAb && cachedMv) return
    if (fetchingAdv.has(row.name)) return
    fetchingAdv.add(row.name)

    fetch(`/api/cc/${encodeURIComponent(row.name)}`)
      .then(r => r.json())
      .then(data => {
        const usages = data?.usages ?? data?.pokemon?.usages
        const champions = usages?.find((u: { provider: string }) => u.provider === 'champions')

        const abilities: CCAbility[] = champions?.usageAbilities ?? []
        if (abilities.length > 0) {
          advAbilityCache.set(row.name, abilities)
          setCCAbilities(abilities)
          if (!row.advAbility) {
            const top = abilities[0]?.ability?.name
            if (top) dispatch({ type: 'SET_ADV_ABILITY', pokeName: row.name, value: top })
          }
        }

        const allMoves: CCMove[] = champions?.usageMoves ?? []
        const offensive = allMoves.filter(m => {
          const md = MOVE_DATA[m.move?.name ?? '']
          return md && md.category !== 'Status' && md.bp > 0
        })
        if (offensive.length > 0) {
          advMovesCache.set(row.name, offensive)
          setCCMoves(offensive)
        }
      })
      .catch(() => {})
  }, [row.name])

  const abilityOptions: SearchOption[] = ccAbilities.map(c => ({
    value: c.ability.name,
    label: c.ability.name,
    meta: c.percent > 0 ? `${fmt(c.percent)}%` : undefined,
  }))

  const currentAbility = row.advAbility || ccAbilities[0]?.ability?.name || ''

  const isOHKO = row.isOHKO
  const isKO   = row.isKO
  const rowBg  = isOHKO ? 'ohko-row' : row.minPct < 50 ? 'ko-low-row' : isKO ? 'ko-row' : ''

  const usage = USAGE_MAP[row.name]

  const spMap: Record<string, number> = {
    hp: row.spHP ?? 0, df: row.spDf ?? 0, sd: row.spSd ?? 0,
    sp: row.spSp ?? 0, at: row.spAt ?? 0, sa: row.spSa ?? 0,
  }
  type AdvStatKey = 'sp_hp'|'sp_df'|'sp_sd'|'sp_sp'|'sp_at'|'sp_sa'

  function stepAdvStat(statKey: string, delta: number, e: React.MouseEvent) {
    e.stopPropagation()
    const spKey = ('sp_' + statKey) as AdvStatKey
    const next = Math.max(0, Math.min(32, (spMap[statKey] ?? 0) + delta))
    dispatch({ type: 'SET_ADV_STAT', pokeName: row.name, statKey: spKey, value: next })
  }

  function commitAdvStat(statKey: string, el: HTMLElement, e: React.FocusEvent) {
    e.stopPropagation()
    const val = Math.max(0, Math.min(32, parseInt(el.textContent || '0') || 0))
    el.textContent = String(val)
    dispatch({ type: 'SET_ADV_STAT', pokeName: row.name, statKey: ('sp_' + statKey) as AdvStatKey, value: val })
  }

  const { weather, terrain } = state

  // Speed comparison
  const atkSlot = state.selectedSlot !== null ? state.team[state.selectedSlot] : null
  const atkPokeData = atkSlot ? POKE_DATA[getEffectivePokeName(atkSlot)] : null
  const atkSpeed = (atkPokeData && atkSlot)
    ? calcStat(atkPokeData.bs.sp, atkSlot.sps.sp, [atkSlot.natPlus, atkSlot.natMinus], 'sp')
    : null
  const advPokeData = POKE_DATA[row.name]
  const advSpeed = advPokeData
    ? calcStat(advPokeData.bs.sp, row.spSp ?? 0, [row.advNatPlus ?? '', row.advNatMinus ?? ''], 'sp')
    : null

  // Reverse damage: adversary moves → selected Pokémon
  const topMoves = ccMoves.slice(0, 4)
  const atkDefPokeData = atkSlot ? POKE_DATA[getEffectivePokeName(atkSlot)] : null
  const advAtkSps = { hp: 0, at: row.spAt ?? 0, df: 0, sa: row.spSa ?? 0, sd: 0, sp: 0 }
  const advAtkStats = advPokeData ? getStats(advPokeData, advAtkSps, row.advNatPlus || '', row.advNatMinus || '') : null
  const advFakeSlot: TeamSlot = {
    id: -1, pokemon: row.name, megaForme: '',
    ability: currentAbility || (advPokeData?.ab as string) || '',
    item: '(No Item)',
    natPlus: row.advNatPlus || '', natMinus: row.advNatMinus || '',
    sps: advAtkSps,
    boosts: { at: 0, df: 0, sa: 0, sd: 0, sp: 0 },
    moves: ['', '', '', ''],
    ccMoves: null, ccItems: null, ccAbilities: null,
    preMegaAbility: '', preMegaItem: '',
  }
  const atkAsDefOverride = atkSlot ? {
    sp_hp: atkSlot.sps.hp, sp_df: atkSlot.sps.df, sp_sd: atkSlot.sps.sd,
    sp_sp: atkSlot.sps.sp, sp_at: atkSlot.sps.at, sp_sa: atkSlot.sps.sa,
    natPlus: atkSlot.natPlus, natMinus: atkSlot.natMinus,
    ability: atkSlot.ability || '',
  } : null
  const revCtx = (advPokeData && advAtkStats && atkDefPokeData && atkAsDefOverride)
    ? buildCalcCtx(advFakeSlot, advAtkStats, atkDefPokeData, atkAsDefOverride, weather, terrain)
    : null
  const defCalcResults = topMoves.map(m => revCtx ? calcOneMoveResult(m.move.name, revCtx) : null)
  const slots = row.moveResults as (MoveSlotResult | null)[]

  return (
    <>
      <tr className={'mainrow ' + rowBg}>
        <td>
          <div className="adv-block">
            <div className="adv-block-left">
              <div className="poke-name-info">
                <img className="adv-sprite" src={spriteUrl(row.name)} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />
                <strong>{row.name}</strong>
                {usage !== undefined && (
                  <span style={{ fontSize:10, color:'var(--muted)', fontFamily:"'IBM Plex Mono',monospace", flexShrink:0 }}>
                    {usage.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="poke-controls-spinners">
                {(['hp','df','sd'] as const).map(key => (
                  <div key={key} className="def-spinner">
                    <span className="def-spinner-label">{{ hp:'HP', df:'DEF', sd:'SpD' }[key]}</span>
                    <button className="def-sp-btn" onClick={e => stepAdvStat(key, 1, e)}>▲</button>
                    <span
                      className="def-sp-val"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={e => commitAdvStat(key, e.currentTarget, e)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                      onClick={e => e.stopPropagation()}
                    >{spMap[key]}</span>
                    <button className="def-sp-btn" onClick={e => stepAdvStat(key, -1, e)}>▼</button>
                  </div>
                ))}
              </div>
              <div className="poke-controls-spinners">
                {(['sp','at','sa'] as const).map(key => (
                  <div key={key} className="def-spinner">
                    <span className="def-spinner-label">{{ sp:'SPE', at:'ATK', sa:'SpA' }[key]}</span>
                    <button className="def-sp-btn" onClick={e => stepAdvStat(key, 1, e)}>▲</button>
                    <span
                      className="def-sp-val"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={e => commitAdvStat(key, e.currentTarget, e)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                      onClick={e => e.stopPropagation()}
                    >{spMap[key]}</span>
                    <button className="def-sp-btn" onClick={e => stepAdvStat(key, -1, e)}>▼</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="adv-block-right" onClick={e => e.stopPropagation()}>
              <div className="adv-sel-cell">
                {abilityOptions.length > 0 && (
                  <SearchSelect
                    value={currentAbility}
                    options={abilityOptions}
                    onChange={v => dispatch({ type: 'SET_ADV_ABILITY', pokeName: row.name, value: v })}
                    placeholder="— Talent —"
                  />
                )}
              </div>
              <select
                className={'adv-nat-sel' + (row.advNatPlus ? ' boosted' : '')}
                value={row.advNatPlus || ''}
                onChange={e => { e.stopPropagation(); dispatch({ type: 'SET_ADV_NATURE', pokeName: row.name, field: 'natPlus', value: e.target.value }) }}
                onClick={e => e.stopPropagation()}
              >
                <option value="">(+)</option>
                {NATURE_STATS.map(s => <option key={s} value={s}>{NATURE_STAT_LABELS[s]} +10%</option>)}
              </select>
              <select
                className={'adv-nat-sel' + (row.advNatMinus ? ' dropped' : '')}
                value={row.advNatMinus || ''}
                onChange={e => { e.stopPropagation(); dispatch({ type: 'SET_ADV_NATURE', pokeName: row.name, field: 'natMinus', value: e.target.value }) }}
                onClick={e => e.stopPropagation()}
              >
                <option value="">(-)</option>
                {NATURE_STATS.map(s => <option key={s} value={s}>{NATURE_STAT_LABELS[s]} -10%</option>)}
              </select>
            </div>
          </div>
        </td>
        <td className="adv-moves-cell">
          <MoveSlotDiv slot={slots[0] ?? null} />
          <MoveSlotDiv slot={slots[1] ?? null} />
          <MoveSlotDiv slot={slots[2] ?? null} />
          <MoveSlotDiv slot={slots[3] ?? null} />
        </td>
        <td className="adv-moves-cell">
          {topMoves.length > 0 ? topMoves.map(m => {
            const md = MOVE_DATA[m.move.name]
            return (
              <div key={m.move.name} className="adv-move-row">
                <span className="type-dot" style={{ background: `var(--${md?.type ?? 'Normal'})` }} />
                <span className="adv-move-name">{m.move.name}</span>
                {m.percent > 0 && <span className="adv-move-pct">{fmt(m.percent)}%</span>}
              </div>
            )
          }) : <span className="adv-moves-empty">—</span>}
        </td>
        <td className="speed-cell">
          {atkSpeed !== null && advSpeed !== null && (
            <div className="speed-compare">
              <span className={'speed-val' + (atkSpeed > advSpeed ? ' spd-win' : atkSpeed < advSpeed ? ' spd-lose' : ' spd-tie')}>
                {atkSpeed}
              </span>
              <span className="spd-arrow">
                {atkSpeed > advSpeed ? '▶' : atkSpeed < advSpeed ? '◀' : '='}
              </span>
              <span className={'speed-val' + (advSpeed > atkSpeed ? ' spd-win' : advSpeed < atkSpeed ? ' spd-lose' : ' spd-tie')}>
                {advSpeed}
              </span>
            </div>
          )}
        </td>
      </tr>
    </>
  )
}
