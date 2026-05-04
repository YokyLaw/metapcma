'use client'

import { useState } from 'react'
import '../../styles/teamPanel.css'
import { useAppState } from '../../context/AppContext'
import { spriteUrl, itemSpriteUrl } from '../../calc/teamHelpers'
import { MEGA_MAP } from '../../data/megaMap'
import { NATURE_DATA } from '../../data/constants'
import { POKE_DATA } from '../../data/pokeData'
import PokemonCard from './PokemonCard'
import FieldBar from '../FieldBar'

const MEGA_STONES = new Set(
  Object.values(MEGA_MAP).flatMap(formes => Object.values(formes))
)

export default function TeamPanel() {
  const { state, dispatch } = useAppState()
  const { team, selectedSlot } = state
  const activeSlot = selectedSlot ?? 0
  const [teamCopied, setTeamCopied] = useState(false)

  function handleExportTeam() {
    const EV_LABELS: Record<string, string> = { hp:'HP', at:'Atk', df:'Def', sa:'SpA', sd:'SpD', sp:'Spe' }
    const blocks = team
      .filter(slot => slot.pokemon)
      .map(slot => {
        const sps = slot.sps as Record<string, number>
        const evParts = (['hp','at','df','sa','sd','sp'] as const)
          .filter(k => (sps[k] ?? 0) > 0)
          .map(k => `${sps[k]} ${EV_LABELS[k]}`)
        const natureName = Object.entries(NATURE_DATA).find(
          ([, [p, m]]) => p === slot.natPlus && m === slot.natMinus && (p !== '' || m !== '')
        )?.[0] ?? 'Hardy'
        const itemLine = slot.item && slot.item !== '(No Item)' ? ` @ ${slot.item}` : ''
        const notes = (state.slotNotes[slot.id] || '').trim()
        const notesBlock = notes ? '\n' + notes.split('\n').map(l => `// ${l}`).join('\n') : ''
        return [
          `${slot.pokemon}${itemLine}`,
          slot.ability ? `Ability: ${slot.ability}` : '',
          'Level: 50',
          evParts.length ? `EVs: ${evParts.join(' / ')}` : '',
          `${natureName} Nature`,
          ...slot.moves.filter(Boolean).map(m => `- ${m}`),
        ].filter(Boolean).join('\n') + notesBlock
      })
    if (!blocks.length) return
    navigator.clipboard.writeText(blocks.join('\n\n')).then(() => {
      setTeamCopied(true)
      setTimeout(() => setTeamCopied(false), 2000)
    }).catch(() => {})
  }

  function handleImportTeam() {
    navigator.clipboard.readText().then(text => {
      const blocks = text.trim().split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)
      const EV_REVERSE: Record<string, string> = { HP:'hp', Atk:'at', Def:'df', SpA:'sa', SpD:'sd', Spe:'sp' }
      const newTeam = Array.from({ length: 6 }, (_, i) => ({
        id: i,
        pokemon: '',
        megaForme: '',
        ability: '',
        item: '(No Item)',
        natPlus: '',
        natMinus: '',
        sps: { hp:0, at:0, df:0, sa:0, sd:0, sp:0 },
        boosts: { at:0, df:0, sa:0, sd:0, sp:0 },
        moves: ['','','',''] as [string,string,string,string],
        ccMoves: null,
        ccItems: null,
        ccAbilities: null,
        ccAllAbilities: null,
        ccNature: null,
        ccSps: null,
        preMegaAbility: '',
        preMegaItem: '',
        useDefaultSet: false,
        preDefaultSet: null,
      }))
      blocks.slice(0, 6).forEach((block, i) => {
        const lines = block.split('\n').map(l => l.trim()).filter(l => !l.startsWith('//'))
        if (!lines.length) return
        const firstLine = lines[0]
        const atIdx = firstLine.indexOf(' @ ')
        const pokeName = (atIdx >= 0 ? firstLine.slice(0, atIdx) : firstLine).trim()
        if (!POKE_DATA[pokeName]) return
        const item = atIdx >= 0 ? firstLine.slice(atIdx + 3).trim() : '(No Item)'
        let ability = ''
        let natPlus = ''
        let natMinus = ''
        const sps: Record<string, number> = { hp:0, at:0, df:0, sa:0, sd:0, sp:0 }
        const moves: string[] = []
        for (const line of lines.slice(1)) {
          if (line.startsWith('Ability: ')) {
            ability = line.slice(9).trim()
          } else if (line.startsWith('EVs: ')) {
            line.slice(5).split('/').forEach(part => {
              const m = part.trim().match(/^(\d+)\s+(.+)$/)
              if (m) { const stat = EV_REVERSE[m[2].trim()]; if (stat) sps[stat] = parseInt(m[1]) }
            })
          } else if (line.endsWith(' Nature')) {
            const natureName = line.slice(0, -7).trim()
            const found = Object.entries(NATURE_DATA).find(([name]) => name === natureName)
            if (found) { natPlus = found[1][0]; natMinus = found[1][1] }
          } else if (line.startsWith('- ')) {
            moves.push(line.slice(2).trim())
          }
        }
        const filledMoves = [...moves.slice(0, 4), '', '', '', ''].slice(0, 4) as [string,string,string,string]
        newTeam[i] = {
          ...newTeam[i],
          pokemon: pokeName,
          ability: ability || (POKE_DATA[pokeName]?.ab ?? ''),
          item,
          natPlus,
          natMinus,
          sps: { hp: sps.hp, at: sps.at, df: sps.df, sa: sps.sa, sd: sps.sd, sp: sps.sp },
          moves: filledMoves,
        }
      })
      dispatch({ type: 'LOAD_STATE', payload: { team: newTeam } })
    }).catch(() => {})
  }

  return (
    <div className="team-panel">
      <div className="showdown-btn-group team-showdown-btns">
        <button
          className="import-showdown-btn"
          onClick={handleImportTeam}
          title="Importer toute la team depuis Pokémon Showdown"
        >
          Import Team
        </button>
        <button
          className={'export-showdown-btn' + (teamCopied ? ' copied' : '')}
          onClick={handleExportTeam}
          title="Exporter toute la team vers Pokémon Showdown"
        >
          {teamCopied ? '✓ Copié !' : 'Export Team'}
        </button>
      </div>
      <div className="team-slot-bar">
        {team.map((slot, i) => {
          const hasItem = slot.item && slot.item !== '(No Item)'

          return (
            <button
              key={i}
              className={'slot-btn' + (i === activeSlot ? ' active' : '')}
              onClick={() => dispatch({ type: 'SELECT_SLOT', slot: i })}
            >
              {slot.pokemon ? (
                <>
                  <img
                    src={spriteUrl(slot.pokemon)}
                    alt={slot.pokemon}
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />
                  {hasItem && (
                    <img
                      className={'slot-stone-overlay' + (MEGA_STONES.has(slot.item) ? ' mega' : '')}
                      src={itemSpriteUrl(slot.item)}
                      alt=""
                      onError={e => { e.currentTarget.style.display = 'none' }}
                    />
                  )}
                </>
              ) : (
                <span className="slot-btn-num">{i + 1}</span>
              )}
            </button>
          )
        })}
      </div>
      <div className="team-card-area">
        <PokemonCard slotIndex={activeSlot} />
      </div>
      <FieldBar />
    </div>
  )
}
