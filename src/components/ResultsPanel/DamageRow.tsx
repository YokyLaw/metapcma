import { useEffect } from 'react'
import { useAppState } from '../../context/AppContext'
import { USAGE_MAP } from '../../data/usageData'
import { NATURE_STATS, NATURE_STAT_LABELS } from '../../data/constants'
import { spriteUrl, getEffectivePokeName, getAbilitiesFor, getBaseNameForCC } from '../../calc/teamHelpers'
import { POKE_DATA } from '../../data/pokeData'
import { MOVE_DATA } from '../../data/moveData'
import { calcStat, getStats } from '../../calc/statCalc'
import { buildCalcCtx, calcOneMoveResult } from '../../calc/damageCalc'
import { getAbilityDesc } from '../../hooks/useAbilityDesc'
import { useAdvCC } from '../../hooks/useAdvCC'
import type { TableRow, MoveSlotResult, TeamSlot } from '../../types'
import SearchSelect from '../TeamPanel/SearchSelect'
import type { SearchOption } from '../TeamPanel/SearchSelect'
import '../../styles/teamPanel.css'

interface Props {
  row: TableRow & {
    spHP?: number; spDf?: number; spSd?: number
    spSp?: number; spAt?: number; spSa?: number
    advNatPlus?: string; advNatMinus?: string; advAbility?: string
  }
  onSelect?: () => void
  isSelected?: boolean
  simplified?: boolean
}

function fmt(pct: number): string {
  return (Math.floor(pct * 10) / 10).toFixed(1)
}

export function MoveSlotDiv({ slot }: { slot: MoveSlotResult | null }) {
  if (!slot) return <div className="adv-move-row"><span className="adv-moves-empty">—</span></div>

  const { calc } = slot
  const pctClass = !calc ? '' :
    calc.minPct >= 100 ? ' ohko' :
    calc.maxPct >= 100 ? ' ko-poss' :
    calc.minPct >= 50  ? ' ko-mid' :
    calc.minPct >= 25  ? ' ko' :
    ' ko-low'

  return (
    <div className={'adv-move-row' + pctClass}>
      <span className="type-dot" style={{ background: `var(--${slot.moveType})` }} />
      <span className="adv-move-name">{slot.move}</span>
      {slot.immune
        ? <span className="adv-move-pct adv-move-immune">(Immune)</span>
        : calc && <span className="adv-move-pct">{fmt(calc.minPct)}%–{fmt(calc.maxPct)}%</span>
      }
    </div>
  )
}

export default function DamageRow({ row, onSelect, isSelected, simplified }: Props) {
  const baseName  = getBaseNameForCC(row.name)
  const isMegaRow = row.name !== baseName

  const { state, dispatch } = useAppState()
  const { ccAbilities, ccMoves } = useAdvCC(row.name)

  // Set default ability when CC data first loads
  useEffect(() => {
    if (!isMegaRow && ccAbilities.length > 0 && !row.advAbility) {
      const top = ccAbilities[0]?.ability?.name
      if (top) dispatch({ type: 'SET_ADV_ABILITY', pokeName: row.name, value: top })
    }
  }, [ccAbilities.length])

  const advPokeData = POKE_DATA[row.name]

  const megaOwnAbilities = isMegaRow ? (getAbilitiesFor(row.name) ?? []) : []
  const allKnownAbilities = isMegaRow ? megaOwnAbilities : (getAbilitiesFor(row.name) ?? [])

  const abilityOptions: SearchOption[] = isMegaRow
    ? megaOwnAbilities.map(a => ({ value: a, label: a }))
    : (() => {
        const ccSet = new Set(ccAbilities.map(c => c.ability.name))
        const extra = allKnownAbilities.filter(a => !ccSet.has(a)).map(a => ({ value: a, label: a }))
        return [
          ...ccAbilities.map(c => ({
            value: c.ability.name,
            label: c.ability.name,
            meta: c.percent > 0 ? `${fmt(c.percent)}%` : undefined,
          })),
          ...extra,
        ]
      })()

  const currentAbility = row.advAbility
    || (isMegaRow ? megaOwnAbilities[0] : ccAbilities[0]?.ability?.name)
    || allKnownAbilities[0]
    || (advPokeData?.ab as string)
    || ''

  const usage = USAGE_MAP[row.name]
  const isFavorite = state.favorites.includes(row.name)

  const spMap: Record<string, number> = {
    hp: row.spHP ?? 0, df: row.spDf ?? 0, sd: row.spSd ?? 0,
    sp: row.spSp ?? 0, at: row.spAt ?? 0, sa: row.spSa ?? 0,
  }
  type AdvStatKey = 'sp_hp'|'sp_df'|'sp_sd'|'sp_sp'|'sp_at'|'sp_sa'

  function stepAdvStat(statKey: string, delta: number, e: React.UIEvent) {
    e.stopPropagation()
    e.preventDefault()
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
  const advSpeed = advPokeData
    ? calcStat(advPokeData.bs.sp, row.spSp ?? 0, [row.advNatPlus ?? '', row.advNatMinus ?? ''], 'sp')
    : null

  // Reverse damage: adversary moves → selected Pokémon
  const topMoves = (() => {
    if (row.name === 'Mega Charizard X') {
      const protect     = ccMoves.filter(m => m.move.name === 'Protect')
      const offensive   = ccMoves.filter(m => MOVE_DATA[m.move.name]?.category === 'Physical')
      const dragonDance = ccMoves.filter(m => m.move.name === 'Dragon Dance')
      return [...protect, ...offensive, ...dragonDance].slice(0, 4)
    }
    if (row.name === 'Mega Charizard Y') {
      const offensive = ccMoves.filter(m => MOVE_DATA[m.move.name]?.category === 'Special')
      const status    = ccMoves.filter(m => MOVE_DATA[m.move.name]?.category === 'Status')
      return [...offensive, ...status].slice(0, 4)
    }
    return ccMoves.slice(0, 4)
  })()
  const atkDefPokeData = atkSlot ? POKE_DATA[getEffectivePokeName(atkSlot)] : null
  const advAtkSps = { hp: 0, at: row.spAt ?? 0, df: 0, sa: row.spSa ?? 0, sd: 0, sp: 0 }
  const advAtkStats = advPokeData ? getStats(advPokeData, advAtkSps, row.advNatPlus || '', row.advNatMinus || '') : null
  const advFakeSlot: TeamSlot = {
    id: -1, pokemon: row.name, megaForme: '',
    ability: currentAbility || (advPokeData?.ab as string) || '',
    item: state.advItems[row.name] || '(No Item)',
    natPlus: row.advNatPlus || '', natMinus: row.advNatMinus || '',
    sps: advAtkSps,
    boosts: { at: 0, df: 0, sa: 0, sd: 0, sp: 0 },
    moves: ['', '', '', ''],
    ccMoves: null, ccItems: null, ccAbilities: null,
    ccNature: null, ccSps: null,
    preMegaAbility: '', preMegaItem: '',
    useDefaultSet: false, preDefaultSet: null,
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

  const defSlots: (MoveSlotResult | null)[] = topMoves.map(m => {
    const moveType = MOVE_DATA[m.move.name]?.type ?? 'Normal'
    const calc = revCtx ? calcOneMoveResult(m.move.name, revCtx) : null
    return {
      move: m.move.name,
      moveType,
      immune: revCtx !== null && calc === null && (MOVE_DATA[m.move.name]?.bp ?? 0) > 0,
      calc: calc ? { minPct: calc.minPct, maxPct: calc.maxPct, isOHKO: calc.minPct >= 100, isKO: calc.maxPct >= 100 } : null,
    }
  })
  const slots = row.moveResults as (MoveSlotResult | null)[]

  return (
    <>
      <tr
        className={'mainrow' + (isSelected ? ' adv-row-selected' : '') + (onSelect ? ' adv-row-clickable' : '')}
        onClick={onSelect}
      >
        <td className="adv-moves-cell">
          <MoveSlotDiv slot={slots[0] ?? null} />
          <MoveSlotDiv slot={slots[1] ?? null} />
          <MoveSlotDiv slot={slots[2] ?? null} />
          <MoveSlotDiv slot={slots[3] ?? null} />
        </td>
        <td>
          {simplified ? (
            <div className="adv-block-simple">
              <div className="poke-name-info">
                <img className="adv-sprite" src={spriteUrl(row.name)} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />
                <strong>{row.name}</strong>
                {usage !== undefined && (
                  <span style={{ fontSize:10, color:'var(--muted)', fontFamily:"'IBM Plex Mono',monospace", flexShrink:0 }}>
                    {usage.toFixed(1)}%
                  </span>
                )}
                <button
                  className={'fav-star' + (isFavorite ? ' fav-active' : '')}
                  onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_FAVORITE', pokeName: row.name }) }}
                  title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >★</button>
              </div>
              <div className="adv-simple-info">
                {currentAbility && (
                  <span className="adv-simple-tag">{currentAbility}</span>
                )}
                {(row.advNatPlus || row.advNatMinus) && (
                  <span className="adv-simple-tag adv-simple-nature">
                    {row.advNatPlus && <span className="boosted-text">+{NATURE_STAT_LABELS[row.advNatPlus]}</span>}
                    {row.advNatPlus && row.advNatMinus && ' '}
                    {row.advNatMinus && <span className="dropped-text">-{NATURE_STAT_LABELS[row.advNatMinus]}</span>}
                  </span>
                )}
                {(Object.entries(spMap) as [string, number][])
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => (
                    <span key={k} className="adv-simple-tag">
                      {({ hp:'HP', df:'DEF', sd:'SpD', sp:'SPE', at:'ATK', sa:'SpA' } as Record<string,string>)[k]} {v}
                    </span>
                  ))
                }
              </div>
            </div>
          ) : (
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
                  <button
                    className={'fav-star' + (isFavorite ? ' fav-active' : '')}
                    onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_FAVORITE', pokeName: row.name }) }}
                    title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >★</button>
                </div>
                <div className="poke-controls-spinners">
                  {(['hp','df','sd'] as const).map(key => (
                    <div key={key} className="def-spinner">
                      <span className="def-spinner-label">{{ hp:'HP', df:'DEF', sd:'SpD' }[key]}</span>
                      <button className="def-sp-btn-extreme" onClick={e => { e.stopPropagation(); e.preventDefault(); dispatch({ type: 'SET_ADV_STAT', pokeName: row.name, statKey: ('sp_' + key) as AdvStatKey, value: 32 }) }}>⇑</button>
                      <button className="def-sp-btn" onClick={e => stepAdvStat(key, 1, e)}>▲</button>
                      <span
                        className="def-sp-val"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={e => commitAdvStat(key, e.currentTarget, e)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                        onClick={e => { e.stopPropagation(); (e.target as HTMLElement).textContent = '' }}
                        onWheel={e => stepAdvStat(key, e.deltaY < 0 ? 1 : -1, e)}
                      >{spMap[key]}</span>
                      <button className="def-sp-btn" onClick={e => stepAdvStat(key, -1, e)}>▼</button>
                      <button className="def-sp-btn-extreme" onClick={e => { e.stopPropagation(); e.preventDefault(); dispatch({ type: 'SET_ADV_STAT', pokeName: row.name, statKey: ('sp_' + key) as AdvStatKey, value: 0 }) }}>⇓</button>
                    </div>
                  ))}
                </div>
                <div className="poke-controls-spinners">
                  {(['sp','at','sa'] as const).map(key => (
                    <div key={key} className="def-spinner">
                      <span className="def-spinner-label">{{ sp:'SPE', at:'ATK', sa:'SpA' }[key]}</span>
                      <button className="def-sp-btn-extreme" onClick={e => { e.stopPropagation(); e.preventDefault(); dispatch({ type: 'SET_ADV_STAT', pokeName: row.name, statKey: ('sp_' + key) as AdvStatKey, value: 32 }) }}>⇑</button>
                      <button className="def-sp-btn" onClick={e => stepAdvStat(key, 1, e)}>▲</button>
                      <span
                        className="def-sp-val"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={e => commitAdvStat(key, e.currentTarget, e)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                        onClick={e => { e.stopPropagation(); (e.target as HTMLElement).textContent = '' }}
                        onWheel={e => stepAdvStat(key, e.deltaY < 0 ? 1 : -1, e)}
                      >{spMap[key]}</span>
                      <button className="def-sp-btn" onClick={e => stepAdvStat(key, -1, e)}>▼</button>
                      <button className="def-sp-btn-extreme" onClick={e => { e.stopPropagation(); e.preventDefault(); dispatch({ type: 'SET_ADV_STAT', pokeName: row.name, statKey: ('sp_' + key) as AdvStatKey, value: 0 }) }}>⇓</button>
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
                      getDescription={getAbilityDesc}
                      disabled={abilityOptions.length <= 1}
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
          )}
        </td>
        <td className="adv-moves-cell">
          {defSlots.length > 0
            ? defSlots.map((s, i) => <MoveSlotDiv key={i} slot={s} />)
            : <span className="adv-moves-empty">—</span>}
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
