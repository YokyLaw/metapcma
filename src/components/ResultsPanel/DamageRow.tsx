import { useRef } from 'react'
import { useAppState } from '../../context/AppContext'
import { USAGE_MAP } from '../../data/usageData'
import { NATURE_STATS, NATURE_STAT_LABELS } from '../../data/constants'
import { getAbilitiesFor } from '../../calc/teamHelpers'
import type { TableRow } from '../../types'

interface Props {
  row: TableRow & {
    spHP?: number; spDf?: number; spSd?: number
    advNatPlus?: string; advNatMinus?: string; advAbility?: string
    defStatKey?: string
  }
}

export default function DamageRow({ row }: Props) {
  const { dispatch } = useAppState()
  const spHPRef = useRef<HTMLSpanElement>(null)
  const spDefRef = useRef<HTMLSpanElement>(null)

  const isOHKO = row.isOHKO
  const isKO = row.isKO
  const pctClass = isOHKO ? ' ohko' : isKO ? ' ko' : ''
  const rowBg = isOHKO ? 'ohko-row' : isKO ? 'ko-row' : ''

  const usage = USAGE_MAP[row.name]
  const defStatKey = row.defStatKey ?? (row.moveCategory === 'Physical' ? 'df' : 'sd')
  const defLabel = defStatKey === 'df' ? 'DEF' : 'SpD'
  const spDefVal = defStatKey === 'df' ? (row.spDf ?? 0) : (row.spSd ?? 0)

  const defAbilities = getAbilitiesFor(row.name) || []

  function stepAdvStat(statKey: string, delta: number, e: React.MouseEvent) {
    e.stopPropagation()
    const spKey = ('sp_' + statKey) as 'sp_hp' | 'sp_df' | 'sp_sd'
    const cur = spKey === 'sp_hp' ? (row.spHP ?? 0) : spDefVal
    const next = Math.max(0, Math.min(32, cur + delta))
    dispatch({ type: 'SET_ADV_STAT', pokeName: row.name, statKey: spKey, value: next })
  }

  function commitAdvStat(statKey: string, el: HTMLElement, e: React.FocusEvent) {
    e.stopPropagation()
    const val = Math.max(0, Math.min(32, parseInt(el.textContent || '0') || 0))
    el.textContent = String(val)
    dispatch({ type: 'SET_ADV_STAT', pokeName: row.name, statKey: ('sp_' + statKey) as 'sp_hp'|'sp_df'|'sp_sd', value: val })
  }

  return (
    <>
      <tr className={'mainrow ' + rowBg}>
        <td>
          <strong>{row.name}</strong>
          {isOHKO && <span className="ko-badge ohko">OHKO</span>}
          {!isOHKO && isKO && <span className="ko-badge ko">KO?</span>}
          {usage !== undefined && (
            <span style={{ fontSize:10, color:'var(--muted)', fontFamily:"'IBM Plex Mono',monospace", marginLeft:5 }}>
              {usage.toFixed(1)}%
            </span>
          )}
        </td>
        <td>
          <span className="type-dot" style={{ background: `var(--${row.type1})` }} />
          {row.type1}
          {row.type2 && (
            <>
              <span className="type-dot" style={{ background: `var(--${row.type2})`, marginLeft:4 }} />
              {row.type2}
            </>
          )}
        </td>
        <td>
          <span className="type-dot" style={{ background: `var(--${row.moveType})` }} />
          {row.move}
        </td>
        <td className={'pct-text' + pctClass}>
          {(Math.floor(row.minPct * 10) / 10).toFixed(1)}%
        </td>
        <td className={'pct-text' + pctClass}>
          {(Math.floor(row.maxPct * 10) / 10).toFixed(1)}%
        </td>
      </tr>

      <tr className={'subrow ' + rowBg}>
        <td colSpan={5}>
          <div className="subrow-controls">
            {defAbilities.length > 0 && (
              <select
                className={'adv-nat-sel' + (row.advAbility ? ' boosted' : '')}
                value={row.advAbility || ''}
                onChange={e => { e.stopPropagation(); dispatch({ type: 'SET_ADV_ABILITY', pokeName: row.name, value: e.target.value }) }}
                onClick={e => e.stopPropagation()}
              >
                <option value="">(Défaut)</option>
                {defAbilities.map(ab => <option key={ab} value={ab}>{ab}</option>)}
              </select>
            )}

            <div className="def-spinner">
              <span className="def-spinner-label">HP</span>
              <button className="def-sp-btn" onClick={e => stepAdvStat('hp', 1, e)}>▲</button>
              <span
                ref={spHPRef}
                className="def-sp-val"
                contentEditable
                suppressContentEditableWarning
                onBlur={e => commitAdvStat('hp', e.currentTarget, e)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                onClick={e => e.stopPropagation()}
              >
                {row.spHP ?? 0}
              </span>
              <button className="def-sp-btn" onClick={e => stepAdvStat('hp', -1, e)}>▼</button>
            </div>

            <div className="def-spinner">
              <span className="def-spinner-label">{defLabel}</span>
              <button className="def-sp-btn" onClick={e => stepAdvStat(defStatKey, 1, e)}>▲</button>
              <span
                ref={spDefRef}
                className="def-sp-val"
                contentEditable
                suppressContentEditableWarning
                onBlur={e => commitAdvStat(defStatKey, e.currentTarget, e)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                onClick={e => e.stopPropagation()}
              >
                {spDefVal}
              </span>
              <button className="def-sp-btn" onClick={e => stepAdvStat(defStatKey, -1, e)}>▼</button>
            </div>

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
        </td>
      </tr>
    </>
  )
}
