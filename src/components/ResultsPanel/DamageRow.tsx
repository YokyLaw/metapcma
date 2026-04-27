import { useAppState } from '../../context/AppContext'
import { USAGE_MAP } from '../../data/usageData'
import { NATURE_STATS, NATURE_STAT_LABELS } from '../../data/constants'
import { getAbilitiesFor } from '../../calc/teamHelpers'
import type { TableRow, MoveSlotResult } from '../../types'

interface Props {
  row: TableRow & {
    spHP?: number; spDf?: number; spSd?: number
    advNatPlus?: string; advNatMinus?: string; advAbility?: string
  }
}

function fmt(pct: number): string {
  return (Math.floor(pct * 10) / 10).toFixed(1)
}

function MoveSlotDiv({ slot }: { slot: MoveSlotResult | null }) {
  if (!slot) return <div className="dmg-slot empty">—</div>

  const { calc } = slot
  const pctClass = calc?.isOHKO ? ' ohko' : calc?.isKO ? ' ko' : ''

  return (
    <div className={'dmg-slot' + pctClass}>
      <span className="type-dot" style={{ background: `var(--${slot.moveType})` }} />
      <span className="move-cell-name">{slot.move}</span>
      {calc && (
        <span className={'move-cell-pct' + pctClass}>
          {' '}({fmt(calc.minPct)}%–{fmt(calc.maxPct)}%)
        </span>
      )}
      {calc?.isOHKO && <span className="ko-badge ohko">OHKO</span>}
      {!calc?.isOHKO && calc?.isKO && <span className="ko-badge ko">KO?</span>}
    </div>
  )
}

export default function DamageRow({ row }: Props) {
  const { dispatch } = useAppState()

  const isOHKO = row.isOHKO
  const isKO   = row.isKO
  const rowBg  = isOHKO ? 'ohko-row' : isKO ? 'ko-row' : ''

  const usage = USAGE_MAP[row.name]
  const defAbilities = getAbilitiesFor(row.name) || []

  function stepAdvStat(statKey: string, delta: number, e: React.MouseEvent) {
    e.stopPropagation()
    const spKey = ('sp_' + statKey) as 'sp_hp' | 'sp_df' | 'sp_sd'
    const cur = spKey === 'sp_hp' ? (row.spHP ?? 0) : spKey === 'sp_df' ? (row.spDf ?? 0) : (row.spSd ?? 0)
    const next = Math.max(0, Math.min(32, cur + delta))
    dispatch({ type: 'SET_ADV_STAT', pokeName: row.name, statKey: spKey, value: next })
  }

  function commitAdvStat(statKey: string, el: HTMLElement, e: React.FocusEvent) {
    e.stopPropagation()
    const val = Math.max(0, Math.min(32, parseInt(el.textContent || '0') || 0))
    el.textContent = String(val)
    dispatch({ type: 'SET_ADV_STAT', pokeName: row.name, statKey: ('sp_' + statKey) as 'sp_hp'|'sp_df'|'sp_sd', value: val })
  }

  const slots = row.moveResults as (MoveSlotResult | null)[]

  return (
    <>
      <tr className={'mainrow ' + rowBg}>
        <td>
          <div className="poke-name-cell">
            <div className="poke-name-info">
              <strong>{row.name}</strong>
              {isOHKO && <span className="ko-badge ohko">OHKO</span>}
              {!isOHKO && isKO && <span className="ko-badge ko">KO?</span>}
              <span className="poke-type-dots">
                <span className="type-dot" style={{ background: `var(--${row.type1})` }} title={row.type1} />
                {row.type2 && <span className="type-dot" style={{ background: `var(--${row.type2})` }} title={row.type2} />}
              </span>
              {usage !== undefined && (
                <span style={{ fontSize:10, color:'var(--muted)', fontFamily:"'IBM Plex Mono',monospace" }}>
                  {usage.toFixed(1)}%
                </span>
              )}
            </div>
            {defAbilities.length > 0 && (
              <select
                className={'adv-nat-sel' + (row.advAbility || row.defaultAbility ? ' boosted' : '')}
                value={row.advAbility || ''}
                onChange={e => { e.stopPropagation(); dispatch({ type: 'SET_ADV_ABILITY', pokeName: row.name, value: e.target.value }) }}
                onClick={e => e.stopPropagation()}
              >
                <option value="">{row.defaultAbility ?? ''}</option>
                {defAbilities.filter(ab => ab !== row.defaultAbility).map(ab => <option key={ab} value={ab}>{ab}</option>)}
              </select>
            )}
          </div>
          <div className="poke-controls">
            <div className="poke-controls-spinners">
              <div className="def-spinner">
                <span className="def-spinner-label">HP</span>
                <button className="def-sp-btn" onClick={e => stepAdvStat('hp', 1, e)}>▲</button>
                <span
                  className="def-sp-val"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => commitAdvStat('hp', e.currentTarget, e)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                  onClick={e => e.stopPropagation()}
                >{row.spHP ?? 0}</span>
                <button className="def-sp-btn" onClick={e => stepAdvStat('hp', -1, e)}>▼</button>
              </div>
              <div className="def-spinner">
                <span className="def-spinner-label">DEF</span>
                <button className="def-sp-btn" onClick={e => stepAdvStat('df', 1, e)}>▲</button>
                <span
                  className="def-sp-val"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => commitAdvStat('df', e.currentTarget, e)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                  onClick={e => e.stopPropagation()}
                >{row.spDf ?? 0}</span>
                <button className="def-sp-btn" onClick={e => stepAdvStat('df', -1, e)}>▼</button>
              </div>
              <div className="def-spinner">
                <span className="def-spinner-label">SpD</span>
                <button className="def-sp-btn" onClick={e => stepAdvStat('sd', 1, e)}>▲</button>
                <span
                  className="def-sp-val"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => commitAdvStat('sd', e.currentTarget, e)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                  onClick={e => e.stopPropagation()}
                >{row.spSd ?? 0}</span>
                <button className="def-sp-btn" onClick={e => stepAdvStat('sd', -1, e)}>▼</button>
              </div>
            </div>
            <div className="poke-controls-natures">
              <select
                className={'adv-nat-sel' + (row.advNatPlus ? ' boosted' : '')}
                value={row.advNatPlus || ''}
                onChange={e => { e.stopPropagation(); dispatch({ type: 'SET_ADV_NATURE', pokeName: row.name, field: 'natPlus', value: e.target.value }) }}
                onClick={e => e.stopPropagation()}
              >
                <option value="">(Neutre)</option>
                {NATURE_STATS.map(s => <option key={s} value={s}>{NATURE_STAT_LABELS[s]} +10%</option>)}
              </select>
              <select
                className={'adv-nat-sel' + (row.advNatMinus ? ' dropped' : '')}
                value={row.advNatMinus || ''}
                onChange={e => { e.stopPropagation(); dispatch({ type: 'SET_ADV_NATURE', pokeName: row.name, field: 'natMinus', value: e.target.value }) }}
                onClick={e => e.stopPropagation()}
              >
                <option value="">(Neutre)</option>
                {NATURE_STATS.map(s => <option key={s} value={s}>{NATURE_STAT_LABELS[s]} -10%</option>)}
              </select>
            </div>
          </div>
        </td>
        <td className="dmg-cell">
          <div className="dmg-grid">
            <MoveSlotDiv slot={slots[0] ?? null} />
            <MoveSlotDiv slot={slots[1] ?? null} />
            <MoveSlotDiv slot={slots[2] ?? null} />
            <MoveSlotDiv slot={slots[3] ?? null} />
          </div>
        </td>
      </tr>

    </>
  )
}
