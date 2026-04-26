import { useEffect } from 'react'
import { useAppState } from '../../context/AppContext'
import { useFetchCCForSlot } from '../../hooks/useCC'
import { POKE_DATA } from '../../data/pokeData'
import { MOVE_DATA, OFFENSIVE_MOVE_NAMES } from '../../data/moveData'
import { ITEM_DATA } from '../../data/itemData'
import { ABILITY_DATA } from '../../data/abilityData'
import { STAT_KEYS, STAT_LABELS, NATURE_STATS, NATURE_STAT_LABELS } from '../../data/constants'
import { getEffectivePokeName, getAbilitiesFor } from '../../calc/teamHelpers'
import { getStats } from '../../calc/statCalc'
import MegaBar from './MegaBar'
import MoveSlot from './MoveSlot'
import StatItem from './StatItem'

const POKE_NAMES = Object.keys(POKE_DATA).sort()

interface Props {
  slotIndex: number
}

export default function PokemonCard({ slotIndex }: Props) {
  const { state, dispatch } = useAppState()
  const slot = state.team[slotIndex]
  const isSelected = state.selectedSlot === slotIndex
  const fetchCC = useFetchCCForSlot()

  const effectiveName = getEffectivePokeName(slot)
  const pokeData = effectiveName ? POKE_DATA[effectiveName] : null
  const t1 = pokeData?.t1 || ''
  const t2 = pokeData?.t2 || ''

  useEffect(() => {
    if (slot.pokemon) {
      fetchCC(slotIndex, slot.pokemon)
    }
  }, [slot.pokemon])

  function handleCardClick(e: React.MouseEvent) {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'SELECT' || tag === 'INPUT' || tag === 'BUTTON') return
    dispatch({ type: 'SELECT_SLOT', slot: slotIndex })
  }

  function updateField(field: string, value: string) {
    dispatch({ type: 'UPDATE_SLOT_FIELD', slot: slotIndex, field, value })
  }

  // Move pool from CC data or full list
  const ccMoveData = slot.ccMoves as Array<{ move: { name: string }; percent: number }> | null
  const movePercent: Record<string, number> = {}
  let movePool: string[]

  if (ccMoveData && ccMoveData.length > 0) {
    ccMoveData.forEach(m => { movePercent[m.move.name] = m.percent })
    movePool = ccMoveData
      .filter(m => MOVE_DATA[m.move.name]?.bp > 0 && MOVE_DATA[m.move.name]?.category !== 'Status')
      .map(m => m.move.name)
  } else {
    movePool = OFFENSIVE_MOVE_NAMES
  }

  // Item options
  const ccItemsData = slot.ccItems as Array<{ item: { name: string }; percent: number }> | null
  const ccItemNames = ccItemsData ? ccItemsData.map(it => it.item.name) : null
  const itemOptions = ccItemNames
    ? ['(No Item)', ...ccItemNames, ...ITEM_DATA.filter(it => !ccItemNames.includes(it))]
    : ['(No Item)', ...ITEM_DATA]

  // Abilities
  const abilities = getAbilitiesFor(effectiveName) || ABILITY_DATA

  // Computed totals
  const computedStats = pokeData
    ? getStats(pokeData, slot.sps, slot.natPlus, slot.natMinus)
    : null

  function getTotal(key: string): number {
    if (!pokeData) return 0
    if (!computedStats) return 0
    return (computedStats as Record<string, number>)[key] || 0
  }

  return (
    <div
      className={'pokemon-card' + (isSelected ? ' selected' : '')}
      onClick={handleCardClick}
    >
      <div className="card-header">
        <span className="slot-num">{slotIndex + 1}</span>
        <span className="poke-name-display">
          {slot.pokemon || <span className="poke-placeholder">— Vide —</span>}
        </span>
        {t1 && (
          <span className="type-badge" style={{ background: `var(--${t1})` }}>{t1}</span>
        )}
        {t2 && (
          <span className="type-badge" style={{ background: `var(--${t2})` }}>{t2}</span>
        )}
      </div>

      {slot.pokemon && (
        <MegaBar slotIndex={slotIndex} pokemon={slot.pokemon} megaForme={slot.megaForme} />
      )}

      <div className="card-selects">
        <div className="card-selects-full">
          <select
            value={slot.pokemon}
            onChange={e => { e.stopPropagation(); updateField('pokemon', e.target.value) }}
            onClick={e => e.stopPropagation()}
          >
            <option value="">— Choisir Pokémon —</option>
            {POKE_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <select
          value={slot.ability}
          onChange={e => { e.stopPropagation(); updateField('ability', e.target.value) }}
          onClick={e => e.stopPropagation()}
        >
          <option value="">— Talent —</option>
          {abilities.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <select
          value={slot.item}
          onChange={e => { e.stopPropagation(); updateField('item', e.target.value) }}
          onClick={e => e.stopPropagation()}
        >
          {itemOptions.map(it => {
            const ccItemsMap = ccItemsData ? Object.fromEntries(ccItemsData.map(i => [i.item.name, i.percent])) : {}
            const pct = ccItemsMap[it] != null ? ` (${Math.floor(ccItemsMap[it] * 10) / 10}%)` : ''
            return <option key={it} value={it}>{it}{pct}</option>
          })}
        </select>

        <select
          value={slot.natPlus}
          onChange={e => { e.stopPropagation(); updateField('natPlus', e.target.value) }}
          onClick={e => e.stopPropagation()}
        >
          <option value="">(Neutre)</option>
          {NATURE_STATS.map(s => <option key={s} value={s}>{NATURE_STAT_LABELS[s]} +10%</option>)}
        </select>

        <select
          value={slot.natMinus}
          onChange={e => { e.stopPropagation(); updateField('natMinus', e.target.value) }}
          onClick={e => e.stopPropagation()}
        >
          <option value="">(Neutre)</option>
          {NATURE_STATS.map(s => <option key={s} value={s}>{NATURE_STAT_LABELS[s]} -10%</option>)}
        </select>
      </div>

      <div className="stats-grid">
        {STAT_KEYS.map((key, i) => (
          <StatItem
            key={key}
            slotIndex={slotIndex}
            statKey={key}
            statLabel={STAT_LABELS[i]}
            spValue={(slot.sps as Record<string, number>)[key] || 0}
            boostValue={key !== 'hp' ? (slot.boosts as Record<string, number>)[key] || 0 : 0}
            computedTotal={getTotal(key)}
            isBoostable={key !== 'hp'}
          />
        ))}
      </div>

      <div className="moves-section">
        <div className="moves-label">Attaques</div>
        {slot.moves.map((mv, mi) => (
          <MoveSlot
            key={mi}
            slotIndex={slotIndex}
            moveIdx={mi}
            value={mv}
            movePool={movePool}
            movePercent={movePercent}
          />
        ))}
      </div>
    </div>
  )
}
