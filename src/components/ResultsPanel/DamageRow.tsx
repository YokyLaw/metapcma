import { useAppState } from '../../context/AppContext'
import { USAGE_MAP } from '../../data/usageData'
import { NATURE_STATS, NATURE_STAT_LABELS } from '../../data/constants'
import { spriteUrl } from '../../calc/teamHelpers'
import type { TableRow, MoveSlotResult } from '../../types'

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
  if (!slot) return <div className="dmg-slot empty">—</div>

  const { calc } = slot
  const pctClass = calc?.isOHKO ? ' ohko' : calc && calc.minPct < 50 ? ' ko-low' : calc?.isKO ? ' ko' : ''

  return (
    <div className={'dmg-slot' + pctClass}>
      <span className="type-dot" style={{ background: `var(--${slot.moveType})` }} />
      <span className="move-cell-name">{slot.move}</span>
      {calc && (
        <span className={'move-cell-pct' + pctClass}>
          {' '}({fmt(calc.minPct)}%–{fmt(calc.maxPct)}%)
        </span>
      )}
    </div>
  )
}

export default function DamageRow({ row }: Props) {
  const { dispatch } = useAppState()

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

  const slots = row.moveResults as (MoveSlotResult | null)[]

  return (
    <>
      <tr className={'mainrow ' + rowBg}>
        <td>
          <div className="poke-name-cell">
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
          <div className="poke-controls">
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
              <select
                className={'adv-nat-sel' + (row.advNatPlus ? ' boosted' : '')}
                value={row.advNatPlus || ''}
                onChange={e => { e.stopPropagation(); dispatch({ type: 'SET_ADV_NATURE', pokeName: row.name, field: 'natPlus', value: e.target.value }) }}
                onClick={e => e.stopPropagation()}
              >
                <option value="">(+)</option>
                {NATURE_STATS.map(s => <option key={s} value={s}>{NATURE_STAT_LABELS[s]} +10%</option>)}
              </select>
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
