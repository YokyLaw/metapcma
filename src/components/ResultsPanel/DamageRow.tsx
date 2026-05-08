import { useEffect, useMemo } from 'react'
import { useAppState } from '../../context/AppContext'
import { NATURE_STAT_LABELS } from '../../data/constants'
import { spriteUrl, itemSpriteUrl, getEffectivePokeName, getBaseNameForCC } from '../../calc/teamHelpers'
import { POKE_DATA } from '../../data/pokeData'
import { getMoveData } from '../../calc/moveHelpers'
import { calcStat, getStats } from '../../calc/statCalc'
import { buildCalcCtx, calcOneMoveResult } from '../../calc/damageCalc'
import { getAbilityDesc } from '../../hooks/useAbilityDesc'
import { useAdvCC } from '../../hooks/useAdvCC'
import { extractName } from '../../hooks/useCC'
import type { TableRow, MoveSlotResult, TeamSlot, BoostMap } from '../../types'
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
  useAdvStats?: boolean
  onRemove?: () => void
}

function fmt(pct: number): string {
  return (Math.floor(pct * 10) / 10).toFixed(1)
}

export function MoveSlotDiv({ slot, mirrored }: { slot: MoveSlotResult | null; mirrored?: boolean }) {
  if (!slot) return <div className="adv-move-row"><span className="adv-moves-empty">—</span></div>

  const { calc } = slot
  const pctClass = !calc ? '' :
    calc.minPct >= 100 ? ' ohko' :
    calc.maxPct >= 100 ? ' ko-poss' :
    calc.minPct >= 50  ? ' ko-mid' :
    calc.minPct >= 25  ? ' ko' :
    ' ko-low'

  const pctEl = slot.immune
    ? <span className="adv-move-pct adv-move-immune">(Immune)</span>
    : calc ? <span className="adv-move-pct">{fmt(calc.minPct)}%–{fmt(calc.maxPct)}%</span>
    : null
  const dot = <span className="type-dot" style={{ background: `var(--${slot.moveType})` }} />

  if (mirrored) {
    const pctMirrored = slot.immune
      ? <span className="adv-move-pct adv-move-immune" style={{ flex: 1 }}>(Immune)</span>
      : calc ? <span className="adv-move-pct" style={{ flex: 1 }}>{fmt(calc.minPct)}%–{fmt(calc.maxPct)}%</span>
      : <span style={{ flex: 1 }} />
    return (
      <div className={'adv-move-row' + pctClass}>
        {pctMirrored}
        <span className="adv-move-name" style={{ flex: 'none' }}>{slot.move}</span>
        {dot}
      </div>
    )
  }

  return (
    <div className={'adv-move-row' + pctClass}>
      {dot}
      <span className="adv-move-name">{slot.move}</span>
      {pctEl}
    </div>
  )
}

export default function DamageRow({ row, onSelect, isSelected, simplified, useAdvStats, onRemove }: Props) {
  const baseName  = getBaseNameForCC(row.name)
  const isMegaRow = row.name !== baseName

  const { state, dispatch } = useAppState()
  const { ccAbilities, ccMoves, allAbilities } = useAdvCC(row.name)

  // Set default ability when CC data first loads
  useEffect(() => {
    if (!isMegaRow && ccAbilities.length > 0 && !row.advAbility) {
      const top = extractName(ccAbilities[0]?.ability?.name as unknown)
      if (top) dispatch({ type: 'SET_ADV_ABILITY', pokeName: row.id || row.name, value: top })
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
  const spMap: Record<string, number> = {
    hp: row.spHP ?? 0, df: row.spDf ?? 0, sd: row.spSd ?? 0,
    sp: row.spSp ?? 0, at: row.spAt ?? 0, sa: row.spSa ?? 0,
  }
  const { trickRoom, tailwind, advTailwind, weather, terrain, gravity, battleFormat, auroraVeil, reflect, lightScreen, advHelpingHand, advMoves } = state

  // Speed comparison
  const atkSlot = state.selectedSlot !== null ? state.team[state.selectedSlot] : null
  const atkPokeData = atkSlot ? POKE_DATA[getEffectivePokeName(atkSlot)] : null
  const atkSpeed = (atkPokeData && atkSlot)
    ? calcStat(atkPokeData.bs.sp, atkSlot.sps.sp, [atkSlot.natPlus, atkSlot.natMinus], 'sp') * (tailwind ? 2 : 1)
    : null
  const advSpeed = advPokeData
    ? calcStat(advPokeData.bs.sp, row.spSp ?? 0, [row.advNatPlus ?? '', row.advNatMinus ?? ''], 'sp') * (advTailwind ? 2 : 1)
    : null

  const advKey = row.id || row.name
  const advItemForRow = state.advItems[advKey] || '(No Item)'
  const advBoostsForRow = state.advBoosts[advKey] as BoostMap | undefined
  const advMovesForRow = (advMoves[advKey] ?? ['', '', '', '']) as [string, string, string, string]
  const atkSps = atkSlot?.sps
  const atkNatPlus = atkSlot?.natPlus ?? ''
  const atkNatMinus = atkSlot?.natMinus ?? ''
  const atkAbility = atkSlot?.ability ?? ''
  const atkPokemon = atkSlot?.pokemon
  const atkMega = atkSlot?.megaForme

  const revCtx = useMemo(() => {
    const atkDefPokeData = atkSlot ? POKE_DATA[getEffectivePokeName(atkSlot)] : null
    if (!advPokeData || !atkDefPokeData || !atkSlot) return null
    const applyAdv = simplified || !!useAdvStats
    const advAtkSps = { hp: 0, at: applyAdv ? (row.spAt ?? 0) : 0, df: 0, sa: applyAdv ? (row.spSa ?? 0) : 0, sd: 0, sp: 0 }
    const advAtkStats = getStats(advPokeData, advAtkSps, applyAdv ? (row.advNatPlus || '') : '', applyAdv ? (row.advNatMinus || '') : '')
    const advFakeSlot: TeamSlot = {
      id: -1, pokemon: row.name, megaForme: '',
      ability: currentAbility || advPokeData?.ab || '',
      item: applyAdv ? advItemForRow : '(No Item)',
      natPlus: applyAdv ? (row.advNatPlus || '') : '', natMinus: applyAdv ? (row.advNatMinus || '') : '',
      sps: advAtkSps,
      boosts: (applyAdv ? advBoostsForRow : undefined) ?? { at: 0, df: 0, sa: 0, sd: 0, sp: 0 },
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
    return buildCalcCtx(advFakeSlot, advAtkStats, atkDefPokeData, atkAsDefOverride, weather, terrain, gravity, battleFormat === 'doubles', advHelpingHand, auroraVeil, reflect, lightScreen)
  }, [
    advPokeData, row.name, row.spAt, row.spSa, row.advNatPlus, row.advNatMinus,
    currentAbility, advItemForRow,
    atkPokemon, atkMega, atkAbility, atkNatPlus, atkNatMinus,
    atkSps?.hp, atkSps?.at, atkSps?.df, atkSps?.sa, atkSps?.sd, atkSps?.sp,
    weather, terrain, gravity, battleFormat, simplified, useAdvStats, auroraVeil, reflect, lightScreen,
    advBoostsForRow?.at, advBoostsForRow?.df, advBoostsForRow?.sa, advBoostsForRow?.sd, advBoostsForRow?.sp,
    advHelpingHand,
  ])

  const top8OffMoves = useMemo(
    () => ccMoves.filter(m => getMoveData(m.move.name)?.category !== 'Status').slice(0, 8),
    [ccMoves],
  )

  const defMoves = useMemo(() => {
    if (simplified || useAdvStats) {
      return advMovesForRow
        .filter(m => m)
        .map(moveName => {
          const md = getMoveData(moveName)
          const moveType = md?.type ?? 'Normal'
          const calc = revCtx ? calcOneMoveResult(moveName, revCtx) : null
          return {
            name: moveName,
            percent: 0,
            moveType,
            immune: revCtx !== null && calc === null && (md?.bp ?? 0) > 0,
            calc: calc ? { minPct: calc.minPct, maxPct: calc.maxPct } : null,
          }
        })
    }
    return top8OffMoves.map(m => {
      const md = getMoveData(m.move.name)
      const moveType = md?.type ?? 'Normal'
      const calc = revCtx ? calcOneMoveResult(m.move.name, revCtx) : null
      return {
        name: m.move.name,
        percent: m.percent,
        moveType,
        immune: revCtx !== null && calc === null && (md?.bp ?? 0) > 0,
        calc: calc ? { minPct: calc.minPct, maxPct: calc.maxPct } : null,
      }
    })
  }, [simplified, advMovesForRow, top8OffMoves, revCtx])
  const slots = row.moveResults as (MoveSlotResult | null)[]

  return (
    <>
      <tr
        className={'mainrow' + (isSelected ? ' adv-row-selected' : '') + (onSelect ? ' adv-row-clickable' : '')}
        onClick={onSelect}
      >
        {simplified ? (
          <th className="matchup-row-th" scope="row">
            <div className="poke-name-info">
              <img className="adv-sprite" src={spriteUrl(row.name)} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />
              <strong>{row.name}</strong>
              {usage !== undefined && (
                <span style={{ fontSize:10, color:'var(--muted)', fontFamily:"'IBM Plex Mono',monospace", flexShrink:0 }}>
                  {usage.toFixed(1)}%
                </span>
              )}
            </div>
            <div className="adv-simple-info">
              {currentAbility && <span className="adv-simple-tag">{currentAbility}</span>}
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
            {onRemove && (
              <button
                className="matchup-remove-btn"
                onClick={e => { e.stopPropagation(); onRemove() }}
                title="Retirer"
              >
                ×
              </button>
            )}
          </th>
        ) : null}
        <td className="adv-moves-cell">
          {!simplified && (
            <div className="adv-opponent-header">
              <div className="adv-block">
                <div className="adv-block-left">
                  <div className="poke-name-info">
                    {atkSlot && <img className="adv-sprite" src={spriteUrl(getEffectivePokeName(atkSlot))} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />}
                    <strong>{atkSlot ? getEffectivePokeName(atkSlot) : '—'}</strong>
                  </div>
                </div>
                <div className="adv-block-right">
                  <div className="adv-sel-cell adv-inline-row" style={{ flexWrap: 'nowrap' }}>
                    {atkSlot?.ability && <span className="adv-simple-tag">{atkSlot.ability}</span>}
                    {atkSlot?.item && atkSlot.item !== '(No Item)' && (
                      <span className="adv-simple-tag adv-item-tag">
                        <img className="adv-item-icon" src={itemSpriteUrl(atkSlot.item)} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />
                        {atkSlot.item}
                      </span>
                    )}
                    {(atkSlot?.natPlus || atkSlot?.natMinus) && (
                      <span className="adv-simple-tag adv-simple-nature">
                        {atkSlot?.natPlus && <span className="boosted-text">+{NATURE_STAT_LABELS[atkSlot.natPlus]}</span>}
                        {atkSlot?.natMinus && <span className="dropped-text">-{NATURE_STAT_LABELS[atkSlot.natMinus]}</span>}
                      </span>
                    )}
                  </div>
                  <div className="adv-inline-row" style={{ flexWrap: 'nowrap' }}>
                    {atkSlot && (Object.entries(atkSlot.sps) as [string, number][])
                      .filter(([, v]) => v > 0)
                      .map(([k, v]) => (
                        <span key={k} className="adv-simple-tag">
                          {({ hp:'HP', df:'DEF', sd:'SpD', sp:'SPE', at:'ATK', sa:'SpA' } as Record<string,string>)[k]} {v}
                        </span>
                      ))
                    }
                  </div>
                </div>
              </div>
            </div>
          )}
          <MoveSlotDiv slot={slots[0] ?? null} />
          <MoveSlotDiv slot={slots[1] ?? null} />
          <MoveSlotDiv slot={slots[2] ?? null} />
          <MoveSlotDiv slot={slots[3] ?? null} />
        </td>
        <td className="speed-cell">
          {atkSpeed !== null && advSpeed !== null && (
            <div className="speed-compare">
              <span className={'speed-val' + (atkSpeed === advSpeed ? ' spd-tie' : (trickRoom ? atkSpeed < advSpeed : atkSpeed > advSpeed) ? ' spd-win' : ' spd-lose')}>
                {atkSpeed}
              </span>
              <span className="spd-arrow">
                {atkSpeed === advSpeed ? '=' : (trickRoom ? atkSpeed < advSpeed : atkSpeed > advSpeed) ? '▶' : '◀'}
              </span>
              <span className={'speed-val' + (atkSpeed === advSpeed ? ' spd-tie' : (trickRoom ? advSpeed < atkSpeed : advSpeed > atkSpeed) ? ' spd-win' : ' spd-lose')}>
                {advSpeed}
              </span>
            </div>
          )}
        </td>
        <td className="matchup-def-td">
          {onRemove && (
            <button
              className="matchup-remove-btn"
              onClick={e => { e.stopPropagation(); onRemove() }}
              title="Retirer"
            >×</button>
          )}
          {!simplified && (
            <div className="adv-opponent-header">
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
                </div>
                <div className="adv-block-right" onClick={e => e.stopPropagation()}>
                  <div className="adv-sel-cell adv-inline-row" style={{ flexWrap: 'nowrap' }}>
                    {currentAbility && <span className="adv-simple-tag">{currentAbility}</span>}
                    {advItemForRow && advItemForRow !== '(No Item)' && (
                      <span className="adv-simple-tag adv-item-tag">
                        <img className="adv-item-icon" src={itemSpriteUrl(advItemForRow)} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />
                        {advItemForRow}
                      </span>
                    )}
                    {(row.advNatPlus || row.advNatMinus) && (
                      <span className="adv-simple-tag adv-simple-nature">
                        {row.advNatPlus && <span className="boosted-text">+{NATURE_STAT_LABELS[row.advNatPlus]}</span>}
                        {row.advNatMinus && <span className="dropped-text">-{NATURE_STAT_LABELS[row.advNatMinus]}</span>}
                      </span>
                    )}
                  </div>
                  <div className="adv-inline-row" style={{ flexWrap: 'nowrap' }}>
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
              </div>
            </div>
          )}
          {defMoves.length > 0 ? (
            (simplified || useAdvStats) ? (
              <div className="def-moves-col">
                {defMoves.map((m, i) => {
                  const dmgClass = !m.calc ? '' :
                    m.calc.minPct >= 100 ? ' ohko' :
                    m.calc.maxPct >= 100 ? ' ko-poss' :
                    m.calc.minPct >= 50  ? ' ko-mid' :
                    m.calc.minPct >= 25  ? ' ko' :
                    ' ko-low'
                  return (
                    <div key={i} className={'def-move-entry' + dmgClass}>
                      {m.immune
                        ? <span className="def-dmg-pct adv-move-immune">Imm.</span>
                        : m.calc
                        ? <span className="def-dmg-pct">{fmt(m.calc.minPct)}%–{fmt(m.calc.maxPct)}%</span>
                        : <span className="def-dmg-pct" />}
                      <span className="def-move-name">{m.name}</span>
                      <span className="type-dot" style={{ background: `var(--${m.moveType})` }} />
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="def-moves-grid">
                {[defMoves.slice(0, 4), defMoves.slice(4)].map((col, ci) =>
                  col.length > 0 && (
                    <div key={ci} className="def-moves-col">
                      {col.map((m, i) => {
                        const dmgClass = !m.calc ? '' :
                          m.calc.minPct >= 100 ? ' ohko' :
                          m.calc.maxPct >= 100 ? ' ko-poss' :
                          m.calc.minPct >= 50  ? ' ko-mid' :
                          m.calc.minPct >= 25  ? ' ko' :
                          ' ko-low'
                        return (
                          <div key={i} className={'def-move-entry' + dmgClass}>
                            <span className="type-dot" style={{ background: `var(--${m.moveType})` }} />
                            <span className="def-move-name">{m.name}</span>
                            {m.immune
                              ? <span className="def-dmg-pct adv-move-immune">Imm.</span>
                              : m.calc
                              ? <span className="def-dmg-pct">{fmt(m.calc.minPct)}%–{fmt(m.calc.maxPct)}%</span>
                              : null}
                          </div>
                        )
                      })}
                    </div>
                  )
                )}
              </div>
            )
          ) : <span className="adv-moves-empty">—</span>}
        </td>
      </tr>
    </>
  )
}
