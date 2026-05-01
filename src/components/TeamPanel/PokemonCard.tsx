import { useEffect } from 'react'
import { useAppState } from '../../context/AppContext'
import { useFetchCCForSlot } from '../../hooks/useCC'
import { POKE_DATA } from '../../data/pokeData'
import { ITEM_DATA } from '../../data/itemData'
import { ABILITY_DATA } from '../../data/abilityData'
import { STAT_KEYS, STAT_LABELS, NATURE_STATS, NATURE_STAT_LABELS, STAT_BOOST_MULTS } from '../../data/constants'
import { USAGE_MAP } from '../../data/usageData'
import { getEffectivePokeName, getAbilitiesFor, spriteUrl, itemSpriteUrl } from '../../calc/teamHelpers'
import type { CCMoveEntry } from '../../calc/teamHelpers'
import type { CCAbilityEntry } from '../../hooks/useCC'
import { getStats, getItemStatMult } from '../../calc/statCalc'
import { getItemDesc } from '../../hooks/useItemDesc'
import { getAbilityDesc } from '../../hooks/useAbilityDesc'
import MegaBar from './MegaBar'
import MoveSlot from './MoveSlot'
import SearchSelect from './SearchSelect'
import type { SearchOption } from './SearchSelect'
import StatItem from './StatItem'

const POKE_NAMES = Object.keys(POKE_DATA).filter(n => !n.startsWith('Mega ') && n !== 'Aegislash-Shield' && n !== 'Aegislash-Blade').sort((a, b) => {
  const ua = USAGE_MAP[a] ?? -1
  const ub = USAGE_MAP[b] ?? -1
  if (ub !== ua) return ub - ua
  return a.localeCompare(b)
})

const BASE_POKE_OPTIONS: SearchOption[] = POKE_NAMES.map(n => {
  const u = USAGE_MAP[n]
  return { value: n, label: n, meta: u != null ? `${Math.floor(u * 10) / 10}%` : undefined, image: spriteUrl(n) }
})

const NAT_PLUS_OPTIONS: SearchOption[] = NATURE_STATS.map(s => ({
  value: s, label: `${NATURE_STAT_LABELS[s]} +10%`,
}))

const NAT_MINUS_OPTIONS: SearchOption[] = NATURE_STATS.map(s => ({
  value: s, label: `${NATURE_STAT_LABELS[s]} -10%`,
}))

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

  const usedPokemon = new Set(
    state.team.filter((_, i) => i !== slotIndex).map(s => s.pokemon).filter(Boolean)
  )
  const pokeOptions = BASE_POKE_OPTIONS.map(o =>
    usedPokemon.has(o.value) ? { ...o, disabled: true } : o
  )

  useEffect(() => {
    if (slot.pokemon) fetchCC(slotIndex, slot.pokemon)
  }, [slot.pokemon])

  function handleCardClick(e: React.MouseEvent) {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'SELECT' || tag === 'INPUT' || tag === 'BUTTON') return
    dispatch({ type: 'SELECT_SLOT', slot: slotIndex })
  }

  function updateField(field: string, value: string) {
    dispatch({ type: 'UPDATE_SLOT_FIELD', slot: slotIndex, field, value })
  }

  const ccMoveData = slot.ccMoves as CCMoveEntry[] | null
  const moves: CCMoveEntry[] = ccMoveData && ccMoveData.length > 0
    ? ccMoveData
    : slot.moves.filter(Boolean).map(n => ({ move: { name: n }, percent: 0 }))

  // Item options
  const ccItemsData = slot.ccItems as Array<{ item: { name: string }; percent: number }> | null
  const ccItemNames = ccItemsData ? ccItemsData.map(it => it.item.name) : null
  const ccItemsMap = ccItemsData
    ? Object.fromEntries(ccItemsData.map(i => [i.item.name, i.percent]))
    : {}
  const itemList = ccItemNames
    ? ['(No Item)', ...ccItemNames, ...ITEM_DATA.filter(it => !ccItemNames.includes(it))]
    : ['(No Item)', ...ITEM_DATA]
  const usedItems = new Set(
    state.team.filter((_, i) => i !== slotIndex).map(s => s.item).filter(it => it && it !== '(No Item)')
  )
  const itemOptions: SearchOption[] = itemList.map(it => ({
    value: it,
    label: it,
    meta: ccItemsMap[it] != null ? `${Math.floor(ccItemsMap[it] * 10) / 10}%` : undefined,
    image: it !== '(No Item)' ? itemSpriteUrl(it) : undefined,
    disabled: it !== '(No Item)' && usedItems.has(it),
    description: getItemDesc(it),
  }))

  // Ability options — sorted by CC usage if available
  const ccAbilityData = slot.ccAbilities as CCAbilityEntry[] | null
  const baseAbilities = getAbilitiesFor(effectiveName) || ABILITY_DATA
  const abilityOptions: SearchOption[] = ccAbilityData && ccAbilityData.length > 0
    ? ccAbilityData.map(e => ({
        value: e.ability.name,
        label: e.ability.name,
        meta: e.percent > 0 ? `${Math.floor(e.percent * 10) / 10}%` : undefined,
        description: getAbilityDesc(e.ability.name),
      }))
    : baseAbilities.map(a => ({ value: a, label: a, description: getAbilityDesc(a) }))

  // Computed totals
  const computedStats = pokeData
    ? getStats(pokeData, slot.sps, slot.natPlus, slot.natMinus)
    : null

  function getTotal(key: string): number {
    if (!computedStats) return 0
    const base = (computedStats as Record<string, number>)[key] || 0
    if (key === 'hp') return base
    const boostVal = (slot.boosts as Record<string, number>)[key] || 0
    const boostStr = boostVal > 0 ? '+' + boostVal : '' + boostVal
    const boostMult = STAT_BOOST_MULTS[boostStr] ?? 1
    const itemMult = getItemStatMult(slot.item || '', key)
    return Math.floor(base * boostMult * itemMult)
  }

  const basePokeData = slot.pokemon ? POKE_DATA[slot.pokemon] : null
  const megaPokeData = slot.megaForme ? POKE_DATA[slot.megaForme] : null

  function getBaseStatChange(key: string): number {
    if (!basePokeData || !megaPokeData) return 0
    const base = (basePokeData.bs as Record<string, number>)[key] || 0
    const mega = (megaPokeData.bs as Record<string, number>)[key] || 0
    return mega > base ? 1 : mega < base ? -1 : 0
  }

  function getBaseStatDiff(key: string): number {
    if (!basePokeData || !megaPokeData) return 0
    const base = (basePokeData.bs as Record<string, number>)[key] || 0
    const mega = (megaPokeData.bs as Record<string, number>)[key] || 0
    return mega - base
  }

  return (
    <div
      className={'pokemon-card' + (isSelected ? ' selected' : '')}
      onClick={handleCardClick}
    >
      <div className="card-header">
        <span className="slot-num">{slotIndex + 1}</span>
        {(slot.megaForme || slot.pokemon) && (
          <img
            className="card-sprite"
            src={spriteUrl(slot.megaForme || slot.pokemon)}
            alt=""
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        )}
        <span className="poke-name-display">
          {slot.pokemon || <span className="poke-placeholder">— Vide —</span>}
        </span>
        {t1 && <span className="type-badge" style={{ background: `var(--${t1})` }}>{t1}</span>}
        {t2 && <span className="type-badge" style={{ background: `var(--${t2})` }}>{t2}</span>}
      </div>

      {slot.pokemon && (
        <MegaBar slotIndex={slotIndex} pokemon={slot.pokemon} megaForme={slot.megaForme} />
      )}

      <div className="card-selects">
        <div className="card-selects-full">
          <SearchSelect
            value={slot.pokemon}
            options={pokeOptions}
            onChange={name => updateField('pokemon', name)}
            placeholder="— Choisir Pokémon —"
            maxUnfiltered={60}
          />
        </div>

        <SearchSelect
          value={slot.ability}
          options={abilityOptions}
          onChange={v => updateField('ability', v)}
          placeholder="— Talent —"
          getDescription={getAbilityDesc}
          disabled={(!!slot.megaForme && slot.pokemon !== 'Aegislash') || abilityOptions.length <= 1}
          className="search-select--fixed"
        />

        <SearchSelect
          value={slot.item}
          options={itemOptions}
          onChange={v => updateField('item', v)}
          disabled={!!slot.megaForme && slot.pokemon !== 'Aegislash'}
          className="search-select--fixed"
        />

        <SearchSelect
          value={slot.natPlus}
          options={NAT_PLUS_OPTIONS}
          onChange={v => updateField('natPlus', v)}
          placeholder="(Neutre)"
        />

        <SearchSelect
          value={slot.natMinus}
          options={NAT_MINUS_OPTIONS}
          onChange={v => updateField('natMinus', v)}
          placeholder="(Neutre)"
        />
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
            baseStatChange={getBaseStatChange(key)}
            baseStatDiff={getBaseStatDiff(key)}
            baseStat={pokeData ? (pokeData.bs as Record<string, number>)[key] ?? undefined : undefined}
          />
        ))}
      </div>

      <div className="moves-section">
        <div className="moves-label">Attaques</div>
        {slot.moves.map((mv, mi) => {
          const otherSelected = new Set(slot.moves.filter((m, i) => i !== mi && m))
          const availableMoves = moves.filter(m => !otherSelected.has(m.move.name))
          return (
            <MoveSlot
              key={mi}
              slotIndex={slotIndex}
              moveIdx={mi}
              value={mv}
              moves={availableMoves}
            />
          )
        })}
      </div>
    </div>
  )
}
