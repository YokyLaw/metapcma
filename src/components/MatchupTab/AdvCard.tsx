import { useEffect, useRef, useState } from 'react'
import { useAppState } from '../../context/AppContext'
import { POKE_DATA } from '../../data/pokeData'
import { MOVE_DATA } from '../../data/moveData'
import { ITEM_DATA } from '../../data/itemData'
import { USAGE_MAP } from '../../data/usageData'
import { NATURE_DATA, NATURE_STATS, NATURE_STAT_LABELS, STAT_KEYS, STAT_LABELS } from '../../data/constants'
import { spriteUrl, itemSpriteUrl, getAbilitiesFor, getBaseNameForCC, getMegaOptions } from '../../calc/teamHelpers'
import { calcStat } from '../../calc/statCalc'
import { getAbilityDesc } from '../../hooks/useAbilityDesc'
import { getMoveDesc } from '../../hooks/useMoveDesc'
import { useAdvCC } from '../../hooks/useAdvCC'
import SearchSelect from '../TeamPanel/SearchSelect'
import type { SearchOption } from '../TeamPanel/SearchSelect'

const CAT_SHORT: Record<string, string> = { Physical: 'PHY', Special: 'SPC', Status: 'STA' }

type AdvStatKey = 'sp_hp'|'sp_df'|'sp_sd'|'sp_sp'|'sp_at'|'sp_sa'
const STAT_KEY_MAP: Record<string, AdvStatKey> = {
  hp: 'sp_hp', at: 'sp_at', df: 'sp_df', sa: 'sp_sa', sd: 'sp_sd', sp: 'sp_sp',
}

interface AdvStatItemProps {
  pokeName: string
  statKey: string
  statLabel: string
  spValue: number
  baseStat: number
  natPlus: string
  natMinus: string
}

function AdvStatItem({ pokeName, statKey, statLabel, spValue, baseStat, natPlus, natMinus }: AdvStatItemProps) {
  const { dispatch } = useAppState()
  const spValRef = useRef<HTMLSpanElement>(null)

  const computedTotal = statKey === 'hp'
    ? calcStat(baseStat, spValue, ['', ''], 'hp')
    : calcStat(baseStat, spValue, [natPlus, natMinus], statKey as 'at'|'df'|'sa'|'sd'|'sp')

  function step(delta: number, e: React.UIEvent) {
    e.stopPropagation()
    e.preventDefault()
    const next = Math.max(0, Math.min(32, spValue + delta))
    if (next !== spValue) dispatch({ type: 'SET_ADV_STAT', pokeName, statKey: STAT_KEY_MAP[statKey], value: next })
  }

  function commit() {
    if (!spValRef.current) return
    const val = Math.max(0, Math.min(32, parseInt(spValRef.current.textContent || '0') || 0))
    spValRef.current.textContent = String(val)
    dispatch({ type: 'SET_ADV_STAT', pokeName, statKey: STAT_KEY_MAP[statKey], value: val })
  }

  return (
    <div className="stat-item">
      <span className="stat-label">{statLabel}</span>
      <span className="base-stat-ref">{baseStat}</span>
      <div className="sp-spinner">
        <div className="sp-btn-row">
          <button className="sp-btn" onClick={e => step(1, e)}>▲</button>
          <button className="sp-btn-extreme" onClick={e => { e.stopPropagation(); e.preventDefault(); dispatch({ type: 'SET_ADV_STAT', pokeName, statKey: STAT_KEY_MAP[statKey], value: 32 }) }}>⇑</button>
        </div>
        <div className="sp-val-wrap">
          <span
            ref={spValRef}
            className="stat-val"
            contentEditable
            suppressContentEditableWarning
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur() } }}
            onClick={e => { e.stopPropagation(); (e.target as HTMLElement).textContent = '' }}
            onWheel={e => step(e.deltaY < 0 ? 1 : -1, e)}
          >{spValue}</span>
          <span className="stat-total">{computedTotal}</span>
        </div>
        <div className="sp-btn-row">
          <button className="sp-btn" onClick={e => step(-1, e)}>▼</button>
          <button className="sp-btn-extreme" onClick={e => { e.stopPropagation(); e.preventDefault(); dispatch({ type: 'SET_ADV_STAT', pokeName, statKey: STAT_KEY_MAP[statKey], value: 0 }) }}>⇓</button>
        </div>
      </div>
    </div>
  )
}

interface AdvMoveSlotProps {
  pokeName: string
  moveIdx: number
  value: string
  options: SearchOption[]
}

function AdvMoveSlot({ pokeName, moveIdx, value, options }: AdvMoveSlotProps) {
  const { dispatch } = useAppState()
  const md = value ? MOVE_DATA[value] : null
  const dotColor = md ? `var(--${md.type})` : 'var(--muted)'
  const catShort = md?.category ? CAT_SHORT[md.category] : null
  const bp = md && (md as { bp?: number }).bp && (md as { bp?: number }).bp! > 1
    ? (md as { bp?: number }).bp!
    : null

  return (
    <div className="move-slot">
      <div className="move-type-dot" style={{ background: dotColor }} />
      <SearchSelect
        value={value}
        options={options}
        onChange={v => dispatch({ type: 'SET_ADV_MOVE', pokeName, moveIdx, value: v })}
        placeholder="(Aucun)"
        getDescription={getMoveDesc}
      />
      {catShort && (
        <span className="move-cat-badge" style={{ color: dotColor }}>
          {catShort}{bp ? ` ${bp}` : ''}
        </span>
      )}
    </div>
  )
}

const POKE_NAMES_ADV = Object.keys(POKE_DATA)
  .filter(n => !n.startsWith('Mega ') && n !== 'Aegislash-Shield' && n !== 'Aegislash-Blade')
  .sort((a, b) => {
    const ua = USAGE_MAP[a] ?? -1
    const ub = USAGE_MAP[b] ?? -1
    if (ub !== ua) return ub - ua
    return a.localeCompare(b)
  })

const ADV_POKE_OPTIONS: SearchOption[] = POKE_NAMES_ADV.map(n => {
  const u = USAGE_MAP[n]
  return { value: n, label: n, meta: u != null ? `${(Math.floor(u * 10) / 10)}%` : undefined, image: spriteUrl(n) }
})

const NAT_PLUS_OPTIONS:  SearchOption[] = NATURE_STATS.map(s => ({ value: s, label: `${NATURE_STAT_LABELS[s]} +10%` }))
const NAT_MINUS_OPTIONS: SearchOption[] = NATURE_STATS.map(s => ({ value: s, label: `${NATURE_STAT_LABELS[s]} -10%` }))

export default function AdvCard() {
  const { state, dispatch } = useAppState()
  const pokeName = state.matchupAdvName || ''
  const { ccAbilities, ccMoves, ccItems, ccNature, ccSps, isLoaded } = useAdvCC(pokeName)
  const autoTriggeredRef = useRef<string>('')
  const isAutoOn = state.advAutoSet?.[pokeName] ?? false
  const [copied, setCopied] = useState(false)

  const baseName    = getBaseNameForCC(pokeName)
  const isMegaRow   = pokeName !== baseName
  const isAegislash = pokeName === 'Aegislash' || pokeName === 'Aegislash-Blade'
  const advPokeData = pokeName ? POKE_DATA[pokeName] : null

  const adv = state.advStats[pokeName] || {}
  const spMap: Record<string, number> = {
    hp: adv.sp_hp ?? 0, at: adv.sp_at ?? 0, df: adv.sp_df ?? 0,
    sa: adv.sp_sa ?? 0, sd: adv.sp_sd ?? 0, sp: adv.sp_sp ?? 0,
  }
  const advNatPlus  = adv.natPlus  || ''
  const advNatMinus = adv.natMinus || ''
  const advAbility  = adv.ability  || ''
  const advMoves    = state.advMoves[pokeName] ?? ['', '', '', '']
  const advItem     = state.advItems[pokeName] || '(No Item)'

  const megaOwnAbilities  = isMegaRow ? (getAbilitiesFor(pokeName) ?? []) : []
  const allKnownAbilities = isMegaRow ? megaOwnAbilities : (getAbilitiesFor(pokeName) ?? [])

  function fmt(pct: number) { return (Math.floor(pct * 10) / 10).toFixed(1) }

  const abilityOptions: SearchOption[] = isMegaRow
    ? megaOwnAbilities.map(a => ({ value: a, label: a, description: getAbilityDesc(a) }))
    : (() => {
        const ccSet = new Set(ccAbilities.map(c => c.ability.name))
        const extra = allKnownAbilities.filter(a => !ccSet.has(a)).map(a => ({ value: a, label: a, description: getAbilityDesc(a) }))
        return [
          ...ccAbilities.map(c => ({
            value: c.ability.name, label: c.ability.name,
            meta: c.percent > 0 ? `${fmt(c.percent)}%` : undefined,
            description: getAbilityDesc(c.ability.name),
          })),
          ...extra,
        ]
      })()

  const currentAbility = advAbility
    || (isMegaRow ? megaOwnAbilities[0] : ccAbilities[0]?.ability?.name)
    || allKnownAbilities[0]
    || (advPokeData?.ab as string)
    || ''

  const topMoves = (() => {
    if (pokeName === 'Mega Charizard X') {
      const protect     = ccMoves.filter(m => m.move.name === 'Protect')
      const offensive   = ccMoves.filter(m => MOVE_DATA[m.move.name]?.category === 'Physical')
      const dragonDance = ccMoves.filter(m => m.move.name === 'Dragon Dance')
      return [...protect, ...offensive, ...dragonDance].slice(0, 4)
    }
    if (pokeName === 'Mega Charizard Y') {
      const offensive = ccMoves.filter(m => MOVE_DATA[m.move.name]?.category === 'Special')
      const status    = ccMoves.filter(m => MOVE_DATA[m.move.name]?.category === 'Status')
      return [...offensive, ...status].slice(0, 4)
    }
    return ccMoves.slice(0, 4)
  })()

  useEffect(() => {
    if (!pokeName || !isLoaded) return
    if (autoTriggeredRef.current === pokeName) return
    autoTriggeredRef.current = pokeName
    if ((state.advAutoSet?.[pokeName]) !== undefined) return
    handleToggleAuto()
  }, [pokeName, isLoaded])

  const moveOptions: SearchOption[] = ccMoves.map(m => ({
    value: m.move.name, label: m.move.name,
    meta: m.percent > 0 ? `${fmt(m.percent)}%` : undefined,
    description: getMoveDesc(m.move.name),
  }))

  const megaOptions = getMegaOptions(baseName)
  const hasCCData   = ccAbilities.length > 0 || ccMoves.length > 0

  const itemOptions: SearchOption[] = [
    { value: '(No Item)', label: '(No Item)' },
    ...ITEM_DATA.map(it => ({ value: it, label: it, image: itemSpriteUrl(it) })),
  ]

  function handleToggleAuto() {
    const topAbility = isMegaRow
      ? megaOwnAbilities[0] || ''
      : ccAbilities[0]?.ability?.name || allKnownAbilities[0] || ''
    const topItem = (ccItems[0]?.item?.name) || '(No Item)'
    const moves4: [string, string, string, string] = ['', '', '', '']
    topMoves.slice(0, 4).forEach((m, i) => { moves4[i] = m.move.name })
    dispatch({
      type: 'TOGGLE_ADV_AUTO',
      pokeName,
      ccAbility: topAbility,
      ccItem:    topItem,
      ccNatPlus:  ccNature?.natPlus  || '',
      ccNatMinus: ccNature?.natMinus || '',
      ccSps:      ccSps ?? null,
      ccMoves:    moves4,
    })
  }

  const t1 = advPokeData?.t1
  const t2 = advPokeData?.t2

  function buildShowdownText(): string {
    const natureName = Object.entries(NATURE_DATA).find(
      ([, [p, m]]) => p === advNatPlus && m === advNatMinus && (p !== '' || m !== '')
    )?.[0] ?? 'Hardy'

    const EV_LABELS: Record<string, string> = {
      hp: 'HP', at: 'Atk', df: 'Def', sa: 'SpA', sd: 'SpD', sp: 'Spe',
    }
    const evParts = (['hp','at','df','sa','sd','sp'] as const)
      .map(k => ({ key: k, val: spMap[k] ?? 0 }))
      .filter(({ val }) => val > 0)
      .map(({ key, val }) => `${val} ${EV_LABELS[key]}`)
    const evLine = evParts.length ? `EVs: ${evParts.join(' / ')}\n` : ''

    const item = advItem !== '(No Item)' ? advItem : ''
    const itemLine = item ? ` @ ${item}` : ''
    const moves = advMoves.filter(Boolean).map(m => `- ${m}`).join('\n')

    const notes = (state.slotNotes[state.selectedSlot ?? 0] || '').trim()
    const notesBlock = notes
      ? '\n' + notes.split('\n').map(l => `// ${l}`).join('\n')
      : ''

    return `${pokeName}${itemLine}\nAbility: ${currentAbility || ''}\nLevel: 50\n${evLine}${natureName} Nature\n${moves}${notesBlock}`
  }

  function handleExportShowdown() {
    navigator.clipboard.writeText(buildShowdownText()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div className="pokemon-card">
      {advPokeData && (
        <div className="card-header">
          <img className="card-sprite" src={spriteUrl(pokeName)} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />
          <span className="poke-name-display">{pokeName}</span>
          {t1 && <span className="type-badge" style={{ background: `var(--${t1})` }}>{t1}</span>}
          {t2 && <span className="type-badge" style={{ background: `var(--${t2})` }}>{t2}</span>}
        </div>
      )}

      {(isAegislash || megaOptions || hasCCData) && pokeName && (
        <div className="mega-bar">
          {isAegislash && (
            <>
              <span className="mega-label">Formes :</span>
              <button className={'mega-btn' + (pokeName === 'Aegislash' ? ' active' : '')} onClick={() => dispatch({ type: 'SET_MATCHUP_ADV', pokeName: 'Aegislash' })}>Shield</button>
              <button className={'mega-btn' + (pokeName === 'Aegislash-Blade' ? ' active' : '')} onClick={() => dispatch({ type: 'SET_MATCHUP_ADV', pokeName: 'Aegislash-Blade' })}>Blade</button>
            </>
          )}
          {megaOptions && (
            <>
              <span className="mega-label">Formes :</span>
              <button className={'mega-btn' + (!isMegaRow ? ' active' : '')} onClick={() => dispatch({ type: 'SET_MATCHUP_ADV', pokeName: baseName })}>Base</button>
              {Object.keys(megaOptions).map(mf => (
                <button key={mf} className={'mega-btn' + (pokeName === mf ? ' active' : '')} onClick={() => dispatch({ type: 'SET_MATCHUP_ADV', pokeName: mf })}>{mf}</button>
              ))}
            </>
          )}
          {hasCCData && (
            <button className={'mega-btn' + (isAutoOn ? ' active' : '')} style={{ marginLeft: 'auto' }} onClick={handleToggleAuto}>Auto</button>
          )}
        </div>
      )}

      <div className="card-selects">
        <div className="card-selects-full">
          <SearchSelect
            value={baseName}
            options={ADV_POKE_OPTIONS}
            onChange={name => dispatch({ type: 'SET_MATCHUP_ADV', pokeName: name })}
            placeholder="— Choisir adversaire —"
            maxUnfiltered={60}
          />
        </div>
        {advPokeData && (
          <>
            <SearchSelect
              value={currentAbility}
              options={abilityOptions}
              onChange={v => dispatch({ type: 'SET_ADV_ABILITY', pokeName, value: v })}
              placeholder="— Talent —"
              getDescription={getAbilityDesc}
              disabled={abilityOptions.length <= 1}
              className="search-select--fixed"
            />
            <SearchSelect
              value={advItem}
              options={itemOptions}
              onChange={v => dispatch({ type: 'SET_ADV_ITEM', pokeName, value: v })}
              className="search-select--fixed"
            />
            <SearchSelect
              value={advNatPlus}
              options={NAT_PLUS_OPTIONS}
              onChange={v => dispatch({ type: 'SET_ADV_NATURE', pokeName, field: 'natPlus', value: v })}
              placeholder="(Neutre)"
            />
            <SearchSelect
              value={advNatMinus}
              options={NAT_MINUS_OPTIONS}
              onChange={v => dispatch({ type: 'SET_ADV_NATURE', pokeName, field: 'natMinus', value: v })}
              placeholder="(Neutre)"
            />
          </>
        )}
      </div>

      {advPokeData && (
        <>
          <div className="stats-grid">
            {STAT_KEYS.map((key, i) => (
              <AdvStatItem
                key={key}
                pokeName={pokeName}
                statKey={key}
                statLabel={STAT_LABELS[i]}
                spValue={spMap[key] ?? 0}
                baseStat={(advPokeData.bs as Record<string, number>)[key] ?? 0}
                natPlus={advNatPlus}
                natMinus={advNatMinus}
              />
            ))}
          </div>
          <div className="moves-section">
            <div className="moves-label">Attaques</div>
            {advMoves.map((mv, mi) => {
              const otherSelected = new Set(advMoves.filter((m, i) => i !== mi && m))
              const available = moveOptions.filter(o => !otherSelected.has(o.value))
              return (
                <AdvMoveSlot
                  key={mi}
                  pokeName={pokeName}
                  moveIdx={mi}
                  value={mv}
                  options={available}
                />
              )
            })}
          </div>
        </>
      )}

      {pokeName && (
        <button
          className={'export-showdown-btn' + (copied ? ' copied' : '')}
          onClick={handleExportShowdown}
          title="Exporter vers Pokémon Showdown"
        >
          {copied ? '✓ Copié !' : 'Export Showdown'}
        </button>
      )}
    </div>
  )
}
