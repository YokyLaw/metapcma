import { useEffect, useMemo } from 'react'
import { useAppState } from '../../context/AppContext'
import { NATURE_STATS, NATURE_STAT_LABELS } from '../../data/constants'
import { spriteUrl, getEffectivePokeName, getBaseNameForCC } from '../../calc/teamHelpers'
import { POKE_DATA } from '../../data/pokeData'
import { getMoveData } from '../../calc/moveHelpers'
import { calcStat, getStats } from '../../calc/statCalc'
import { buildCalcCtx, calcOneMoveResult } from '../../calc/damageCalc'
import { getAbilityDesc } from '../../hooks/useAbilityDesc'
import { useAdvCC } from '../../hooks/useAdvCC'
import { extractName } from '../../hooks/useCC'
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
  const { ccAbilities, ccMoves, allAbilities } = useAdvCC(row.name)

  // Set default ability when CC data first loads
  useEffect(() => {
    if (!isMegaRow && ccAbilities.length > 0 && !row.advAbility) {
      const top = extractName(ccAbilities[0]?.ability?.name as unknown)
      if (top) dispatch({ type: 'SET_ADV_ABILITY', pokeName: row.name, value: top })
    }
  }, [ccAbilities.length])

  const advPokeData = POKE_DATA[row.name]

  const megaOwnAbility = isMegaRow ? (POKE_DATA[row.name]?.ab ?? '') : ''
  const megaOwnAbilities = useMemo(
    () => isMegaRow && megaOwnAbility ? [megaOwnAbility] : [],
    [isMegaRow, megaOwnAbility],
  )
  const allKnownAbilities = isMegaRow ? megaOwnAbilities : allAbilities

  const abilityOptions: SearchOption[] = useMemo(() => {
    if (isMegaRow) return megaOwnAbilities.map(a => ({ value: a, label: a }))
    const ccSet = new Set(ccAbilities.map(c => extractName(c.ability.name as unknown)))
    const extra = allAbilities.filter(a => !ccSet.has(a)).map(a => ({ value: a, label: a }))
    return [
      ...ccAbilities.map(c => {
        const abilityName = extractName(c.ability.name as unknown)
        return {
          value: abilityName,
          label: abilityName,
          meta: c.percent > 0 ? `${(Math.floor(c.percent * 10) / 10).toFixed(1)}%` : undefined,
        }
      }),
      ...extra,
    ]
  }, [isMegaRow, ccAbilities, megaOwnAbilities, allAbilities])

  const currentAbility = extractName((row.advAbility as unknown) || '')
    || (isMegaRow ? megaOwnAbilities[0] : extractName(ccAbilities[0]?.ability?.name as unknown))
    || allKnownAbilities[0]
    || advPokeData?.ab
    || ''

  const usage = row.usage > 0 ? row.usage : undefined
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

  const topMoves = useMemo(() => {
    if (row.name === 'Mega Charizard X') {
      const protect: typeof ccMoves = []
      const offensive: typeof ccMoves = []
      const dragonDance: typeof ccMoves = []
      for (const m of ccMoves) {
        if (m.move.name === 'Protect') protect.push(m)
        else if (m.move.name === 'Dragon Dance') dragonDance.push(m)
        else if (getMoveData(m.move.name)?.category === 'Physical') offensive.push(m)
      }
      return [...protect, ...offensive, ...dragonDance].slice(0, 4)
    }
    if (row.name === 'Mega Charizard Y') {
      const offensive: typeof ccMoves = []
      const status: typeof ccMoves = []
      for (const m of ccMoves) {
        const cat = getMoveData(m.move.name)?.category
        if (cat === 'Special') offensive.push(m)
        else if (cat === 'Status') status.push(m)
      }
      return [...offensive, ...status].slice(0, 4)
    }
    return ccMoves.slice(0, 4)
  }, [row.name, ccMoves])

  const advItemForRow = state.advItems[row.name] || '(No Item)'
  const atkSps = atkSlot?.sps
  const atkNatPlus = atkSlot?.natPlus ?? ''
  const atkNatMinus = atkSlot?.natMinus ?? ''
  const atkAbility = atkSlot?.ability ?? ''
  const atkPokemon = atkSlot?.pokemon
  const atkMega = atkSlot?.megaForme

  const revCtx = useMemo(() => {
    const atkDefPokeData = atkSlot ? POKE_DATA[getEffectivePokeName(atkSlot)] : null
    if (!advPokeData || !atkDefPokeData || !atkSlot) return null
    const advAtkSps = { hp: 0, at: row.spAt ?? 0, df: 0, sa: row.spSa ?? 0, sd: 0, sp: 0 }
    const advAtkStats = getStats(advPokeData, advAtkSps, row.advNatPlus || '', row.advNatMinus || '')
    const advFakeSlot: TeamSlot = {
      id: -1, pokemon: row.name, megaForme: '',
      ability: currentAbility || advPokeData?.ab || '',
      item: advItemForRow,
      natPlus: row.advNatPlus || '', natMinus: row.advNatMinus || '',
      sps: advAtkSps,
      boosts: { at: 0, df: 0, sa: 0, sd: 0, sp: 0 },
      moves: ['', '', '', ''],
      ccMoves: null, ccItems: null, ccAbilities: null, ccAllAbilities: null,
      ccNature: null, ccSps: null,
      preMegaAbility: '', preMegaItem: '',
      useDefaultSet: false, preDefaultSet: null,
    }
    const atkAsDefOverride = {
      sp_hp: atkSlot.sps.hp, sp_df: atkSlot.sps.df, sp_sd: atkSlot.sps.sd,
      sp_sp: atkSlot.sps.sp, sp_at: atkSlot.sps.at, sp_sa: atkSlot.sps.sa,
      natPlus: atkSlot.natPlus, natMinus: atkSlot.natMinus,
      ability: atkSlot.ability || '',
    }
    return buildCalcCtx(advFakeSlot, advAtkStats, atkDefPokeData, atkAsDefOverride, weather, terrain)
  }, [
    advPokeData, row.name, row.spAt, row.spSa, row.advNatPlus, row.advNatMinus,
    currentAbility, advItemForRow,
    atkPokemon, atkMega, atkAbility, atkNatPlus, atkNatMinus,
    atkSps?.hp, atkSps?.at, atkSps?.df, atkSps?.sa, atkSps?.sd, atkSps?.sp,
    weather, terrain,
  ])

  const defSlots: (MoveSlotResult | null)[] = useMemo(
    () => topMoves.map(m => {
      const md = getMoveData(m.move.name)
      const moveType = md?.type ?? 'Normal'
      const calc = revCtx ? calcOneMoveResult(m.move.name, revCtx) : null
      return {
        move: m.move.name,
        moveType,
        immune: revCtx !== null && calc === null && (md?.bp ?? 0) > 0,
        calc: calc ? { minPct: calc.minPct, maxPct: calc.maxPct, isOHKO: calc.minPct >= 100, isKO: calc.maxPct >= 100 } : null,
      }
    }),
    [topMoves, revCtx],
  )
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
