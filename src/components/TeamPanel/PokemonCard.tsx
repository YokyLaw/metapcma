import { useEffect, useState, useMemo } from 'react'
import { useAppState } from '../../context/AppContext'
import { NATURE_DATA } from '../../data/constants'
import { useFetchCCForSlot, extractName } from '../../hooks/useCC'
import { POKE_DATA } from '../../data/pokeData'
import { STAT_KEYS, STAT_LABELS, NATURE_STATS, NATURE_STAT_LABELS, STAT_BOOST_MULTS } from '../../data/constants'
import { getUsage, useUsageLoaded } from '../../hooks/useUsageData'
import { getEffectivePokeName, spriteUrl, itemSpriteUrl } from '../../calc/teamHelpers'
import type { CCMoveEntry } from '../../calc/teamHelpers'
import type { CCAbilityEntry } from '../../hooks/useCC'
import { getStats, getItemStatMult } from '../../calc/statCalc'
import { getItemDesc, getItemList } from '../../hooks/useItemDesc'
import { getAbilityDesc } from '../../hooks/useAbilityDesc'
import MegaBar from './MegaBar'
import MoveSlot from './MoveSlot'
import SearchSelect from './SearchSelect'
import type { SearchOption } from './SearchSelect'
import StatItem from './StatItem'

const POKE_NAMES_BASE = Object.keys(POKE_DATA)
  .filter(n => !n.startsWith('Mega ') && n !== 'Aegislash-Shield' && n !== 'Aegislash-Blade')

const NAT_PLUS_OPTIONS: SearchOption[] = NATURE_STATS.map(s => ({
  value: s, label: `${NATURE_STAT_LABELS[s]} +10%`,
}))

const NAT_MINUS_OPTIONS: SearchOption[] = NATURE_STATS.map(s => ({
  value: s, label: `${NATURE_STAT_LABELS[s]} -10%`,
}))

interface Props {
  slotIndex: number
  showBoosts?: boolean
}

export default function PokemonCard({ slotIndex, showBoosts = false }: Props) {
  const { state, dispatch } = useAppState()
  const slot = state.team[slotIndex]
  const isSelected = state.selectedSlot === slotIndex
  const [copied, setCopied] = useState(false)
  const fetchCC = useFetchCCForSlot()

  const effectiveName = getEffectivePokeName(slot)
  const pokeData = effectiveName ? POKE_DATA[effectiveName] : null

  const usageLoaded = useUsageLoaded()
  const usedPokemonKey = state.team.map((s, i) => i === slotIndex ? '' : s.pokemon).join('|')
  const usedPokemon = useMemo(
    () => new Set(state.team.filter((_, i) => i !== slotIndex).map(s => s.pokemon).filter(Boolean)),
    [usedPokemonKey],
  )
  const pokeOptions = useMemo(() => {
    const sorted = [...POKE_NAMES_BASE].sort((a, b) => {
      const ua = getUsage(a)
      const ub = getUsage(b)
      if (ub !== ua) return ub - ua
      return a.localeCompare(b)
    })
    return sorted.map(n => {
      const u = getUsage(n)
      const pd = POKE_DATA[n]
      return {
        value: n, label: n,
        meta: u > 0 ? `${Math.floor(u * 10) / 10}%` : undefined,
        image: spriteUrl(n),
        disabled: usedPokemon.has(n),
        types: pd ? [pd.t1, ...(pd.t2 ? [pd.t2] : [])] : undefined,
      }
    })
  }, [usageLoaded, usedPokemon])

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
  const moves: CCMoveEntry[] = useMemo(
    () => ccMoveData && ccMoveData.length > 0
      ? ccMoveData
      : slot.moves.filter(Boolean).map(n => ({ move: { name: n }, percent: 0 })),
    [ccMoveData, slot.moves],
  )

  const ccItemsData = slot.ccItems as Array<{ item: { name: unknown }; percent: number }> | null
  const usedItemsKey = state.team.map((s, i) => i === slotIndex ? '' : s.item).join('|')
  const itemOptions: SearchOption[] = useMemo(() => {
    const ccItemNames = ccItemsData ? ccItemsData.map(it => extractName(it.item.name)) : null
    const ccItemsMap = ccItemsData
      ? Object.fromEntries(ccItemsData.map(i => [extractName(i.item.name), i.percent]))
      : {}
    const baseItems = getItemList()
    const itemList = ccItemNames
      ? ['(No Item)', ...ccItemNames, ...baseItems.filter(it => !ccItemNames.includes(it))]
      : ['(No Item)', ...baseItems]
    const usedItems = new Set(
      state.team.filter((_, i) => i !== slotIndex).map(s => s.item).filter(it => it && it !== '(No Item)')
    )
    return itemList.map(it => ({
      value: it,
      label: it,
      meta: ccItemsMap[it] != null ? `${Math.floor(ccItemsMap[it] * 10) / 10}%` : undefined,
      image: it !== '(No Item)' ? itemSpriteUrl(it) : undefined,
      disabled: it !== '(No Item)' && usedItems.has(it),
      description: getItemDesc(it),
    }))
  }, [ccItemsData, usedItemsKey])

  const ccAbilityData = slot.ccAbilities as CCAbilityEntry[] | null
  const abilityOptions: SearchOption[] = useMemo(() => {
    const baseAbilities: string[] = slot.ccAllAbilities ??
      (effectiveName && POKE_DATA[effectiveName]?.ab ? [POKE_DATA[effectiveName].ab!] : [])
    return ccAbilityData && ccAbilityData.length > 0
      ? [
          ...ccAbilityData.map(e => {
            const abilityName = extractName(e.ability.name)
            return {
              value: abilityName,
              label: abilityName,
              meta: e.percent > 0 ? `${Math.floor(e.percent * 10) / 10}%` : undefined,
              description: getAbilityDesc(abilityName),
            }
          }),
          ...baseAbilities
            .filter(a => !ccAbilityData.some(e => e.ability.name === a))
            .map(a => ({ value: a, label: a, description: getAbilityDesc(a) })),
        ]
      : baseAbilities.map(a => ({ value: a, label: a, description: getAbilityDesc(a) }))
  }, [ccAbilityData, slot.ccAllAbilities, effectiveName])

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

  function handleExportShowdown(e: React.MouseEvent) {
    e.stopPropagation()
    if (!slot.pokemon) return
    const exportName = slot.pokemon
    const sps = slot.sps as Record<string, number>
    const EV_LABELS: Record<string, string> = { hp:'HP', at:'Atk', df:'Def', sa:'SpA', sd:'SpD', sp:'Spe' }
    const evParts = (['hp','at','df','sa','sd','sp'] as const)
      .filter(k => (sps[k] ?? 0) > 0)
      .map(k => `${sps[k]} ${EV_LABELS[k]}`)
    const natureName = Object.entries(NATURE_DATA).find(
      ([, [p, m]]) => p === slot.natPlus && m === slot.natMinus && (p !== '' || m !== '')
    )?.[0] ?? 'Hardy'
    const itemLine = slot.item && slot.item !== '(No Item)' ? ` @ ${slot.item}` : ''
    const notes = (state.slotNotes[slotIndex] || '').trim()
    const notesBlock = notes ? '\n' + notes.split('\n').map(l => `// ${l}`).join('\n') : ''
    const text = [
      `${exportName}${itemLine}`,
      slot.ability ? `Ability: ${slot.ability}` : '',
      'Level: 50',
      evParts.length ? `EVs: ${evParts.join(' / ')}` : '',
      `${natureName} Nature`,
      ...slot.moves.filter(Boolean).map(m => `- ${m}`),
    ].filter(Boolean).join('\n') + notesBlock
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  function handleImportShowdown(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.readText().then(text => {
      const lines = text.trim().split('\n').map(l => l.trim()).filter(l => !l.startsWith('//'))
      if (!lines.length) return
      const firstLine = lines[0]
      const atIdx = firstLine.indexOf(' @ ')
      const pokeName = (atIdx >= 0 ? firstLine.slice(0, atIdx) : firstLine).trim()
      const item = atIdx >= 0 ? firstLine.slice(atIdx + 3).trim() : '(No Item)'
      if (!POKE_DATA[pokeName]) return
      const EV_REVERSE: Record<string, string> = { HP: 'hp', Atk: 'at', Def: 'df', SpA: 'sa', SpD: 'sd', Spe: 'sp' }
      let ability = ''
      let natPlusVal = ''
      let natMinusVal = ''
      const evMap: Record<string, number> = {}
      const moves: string[] = []
      for (const line of lines.slice(1)) {
        if (line.startsWith('Ability: ')) {
          ability = line.slice(9).trim()
        } else if (line.startsWith('EVs: ')) {
          line.slice(5).split('/').forEach(part => {
            const m = part.trim().match(/^(\d+)\s+(.+)$/)
            if (m) { const stat = EV_REVERSE[m[2].trim()]; if (stat) evMap[stat] = parseInt(m[1]) }
          })
        } else if (line.endsWith(' Nature')) {
          const natureName = line.slice(0, -7).trim()
          const found = Object.entries(NATURE_DATA).find(([name]) => name === natureName)
          if (found) { natPlusVal = found[1][0]; natMinusVal = found[1][1] }
        } else if (line.startsWith('- ')) {
          moves.push(line.slice(2).trim())
        }
      }
      dispatch({ type: 'UPDATE_SLOT_FIELD', slot: slotIndex, field: 'pokemon', value: pokeName })
      dispatch({ type: 'UPDATE_SLOT_FIELD', slot: slotIndex, field: 'item', value: item })
      if (ability) dispatch({ type: 'UPDATE_SLOT_FIELD', slot: slotIndex, field: 'ability', value: ability })
      dispatch({ type: 'UPDATE_SLOT_FIELD', slot: slotIndex, field: 'natPlus', value: natPlusVal })
      dispatch({ type: 'UPDATE_SLOT_FIELD', slot: slotIndex, field: 'natMinus', value: natMinusVal })
      ;(['hp', 'at', 'df', 'sa', 'sd', 'sp'] as const).forEach(stat => {
        dispatch({ type: 'UPDATE_SP', slot: slotIndex, stat, value: evMap[stat] ?? 0 })
      })
      const filled = moves.slice(0, 4)
      filled.forEach((move, i) => dispatch({ type: 'UPDATE_MOVE', slot: slotIndex, moveIdx: i, value: move }))
      for (let i = filled.length; i < 4; i++) dispatch({ type: 'UPDATE_MOVE', slot: slotIndex, moveIdx: i, value: '' })
    }).catch(() => {})
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

        {slot.pokemon && (
          <MegaBar slotIndex={slotIndex} pokemon={slot.pokemon} megaForme={slot.megaForme} />
        )}

        <SearchSelect
          value={extractName(slot.ability as unknown)}
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
            isBoostable={showBoosts && key !== 'hp'}
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

      {slot.pokemon && (
        <div className="showdown-btn-group">
          <button
            className="import-showdown-btn"
            onClick={handleImportShowdown}
            title="Importer depuis Pokémon Showdown"
          >
            Import
          </button>
          <button
            className={'export-showdown-btn' + (copied ? ' copied' : '')}
            onClick={handleExportShowdown}
            title="Exporter vers Pokémon Showdown"
          >
            {copied ? '✓ Copié !' : 'Export'}
          </button>
        </div>
      )}
    </div>
  )
}
