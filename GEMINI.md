@RTK.md
Do not make any changes until you have 95% confidence in what you need to build. Ask me follow-up questions until you reach that confidance
“RESPONSE DEFAULTS (apply to every reply unless I override):

- Answer directly. No preamble, filler, affirmations, or trailing summary clauses.
- Use plain prose or tight lists. No decorative headers for short answers.
- Do not use Extended Thinking or web search unless my prompt is explicitly complex or time-sensitive.
- If a task is simple (formatting, grammar, short translation), note once that Haiku may suffice.
- At 6+ messages, offer once to summarize key context for a fresh chat.
- If I request a correction, note once that editing my last message saves tokens.”
- If a task seems unrelated to the previous one, don't do anything, just tell me to use the clear command
- Scope: modifications must only affect the Teambuilder tab content. If any other tab/area (Calc, Matchup, shared state, API routes, etc.) must be modified, ask for explicit permission first before making the change.

#metapcma — VGC Champions Calc                                                                                                                                                                     
    2      
    3 ## Project
    4 Next.js 15 + React 19 + TypeScript. VGC damage calculator with CC (coupcritique.fr) data integration.
    5 Regulation MA: Level 50, 66 SP total cap.
    6
    7 ## Stack
    8 - Next.js App Router (`src/app/`)
    9 - Context API + useReducer (no Redux, no Zustand)
   10 - Plain CSS modules per feature (`src/styles/`)
   11 - No UI lib (MUI/shadcn/etc.)
   12
   13 ## Architecture
   14
   15 ### State (`src/context/`)
   16 - `AppContext.tsx` — Provider + `useAppState()` hook
   17 - `reducer.ts` — Single reducer, 25 action types, 600+ lines
   18 - localStorage persist: 19 keys, guarded by `hasMounted` flag
   19 - Never bypass reducer for state updates — dispatch only
   20
   21 ### Calc Engine (`src/calc/`)
   22 - `damageCalc.ts` — `buildTableRow()` main entry; iterates 4 moves per opponent
   23 - `statCalc.ts` — Gen 9 stat formula with `pokeRound()`
   24 - `teamHelpers.ts` — `getEffectivePokeName()` resolves mega/forme for lookups
   25 - `showdownExport.ts` — Showdown paste format
   26 - Calc trigger: `useCalc()` debounced 150ms, dispatches `SET_TABLE_DATA`
   27
   28 ### API Routes (`src/app/api/cc/`)
   29 Proxy to `coupcritique.fr` — never call CC directly from client.
   30 - `[name]/route.ts` — CC usage + moves/items/abilities
   31 - `usage/route.ts` — Aggregates all Pokémon usage (batched, `revalidate: 86400`)
   32
   33 ### Components (`src/components/`)
   34 3 tab views: **Team** → **Calc** → **Matchup**
   35 - `TeamPanel/PokemonCard` — Main team editor (moves, EVs, nature, item, ability, mega)
   36 - `ResultsPanel/DamageTable` — Filterable damage matrix
   37 - `MatchupTab/AdvCard` — Per-opponent override editor
   38
   39 ## Key Patterns
   40
   41 ### Mega Evolution
   42 - Pre-mega snapshot stored in `TeamSlot` (`preMegaAbility`, `preMegaItem`)
   43 - Restored on deselect
   - Charizard X/Y: moves are no longer filtered by category in the Teambuilder (was X=physical, Y=special)
   45 - `getEffectivePokeName()` resolves display name → base name for lookups
   46
   47 ### Opponent Overrides
   48 - `advStats: Record<pokeName, AdvOverride>` — EVs/nature/ability per opponent
   49 - `advMoves/advItems/advBoosts/advAutoSet` — Advanced customization
   50 - `advAutoSet[pokeName]` toggle auto-applies CC data; `advPreAutoSet` stores pre-state
   51
   52 ### EV/SP Rules
   53 - SP total clamped to 66 (Regulation MA)
   54 - Enforced in reducer, NOT in component
   55 - `BOOST_MULTS` from `constants.ts` for stat boosts
   56
   57 ### Item Uniqueness
   58 - 1 item per team (enforced in reducer `SET_POKEMON_ITEM`)
   59 - Don't add client-side validation — reducer is source of truth
   60
   61 ### Nature Conflict
   62 - +stat and -stat can't be same
   63 - Checked in reducer
   64
   65 ### Default Sets
   66 - `useDefaultSet` flag + snapshot fields in `TeamSlot`
   67 - Toggle restores/applies CC top spread
   68
   69 ## Types (`src/types/index.ts`)
   70 - `TeamSlot` — Full team member (stats, EVs, CC data, mega, boosts, snapshots)
   71 - `PokeEntry` — Base stats + types + weight + abilities
   72 - `MoveEntry` — BP, category, type, effect flags
   73 - `TableRow` — Damage output (minPct, maxPct, KO flags, 4 moves)
   74 - `AdvOverride` — Opponent customization shape
   75
   76 ## Data (`src/data/`)
   77 Static lookup maps — never mutate:
   78 - `POKE_DATA` — name → stats/types/weight/ability
   79 - `MOVE_DATA` — name → MoveEntry
   80 - `ITEM_TYPE_BOOST` — item → type (1.2× calc modifier)
   81 - `MEGA_MAP` — baseName → {megaName → stone}
   82 - `TYPE_EFF` — moveType → {defType → multiplier}
   83 - `NATURE_DATA`, `STAT_LABELS`, `BOOST_MULTS`, weather/terrain options in `constants.ts`
   84
   85 ## Hooks (`src/hooks/`)
   86 - `useCC(pokemonName)` — Fetch CC data for team member
   85 ## Hooks (`src/hooks/`)                          
   86 - `useCC(pokemonName)` — Fetch CC data for team member
   87 - `useAdvCC(pokemonName)` — Same for opponent row 
   88 - `useUsageData()` — Usage % cache in context                           
   89 - `useMoveMeta()` — Move dex (names by Pokémon ID)
   90 - `useTableFilter()` — Filter/sort `tableData` (search, type, KO, usage)
   91                                     
   92 ## CSS                                                                      
   93 - Per-feature files in `src/styles/`
   94 - `teamPanel.css` (571L), `resultsPanel.css` (391L), `matchupTab.css` (213L)
   95 - No CSS-in-JS, no Tailwind
   96                                     
   97 ## Rules                      
   98 - Ask before adding new dependencies                         
   99 - No new state management libs                                                         
  100 - EVs = 252-max individual stats; SP = sum of EVs/4 capped 66                        
  101 - CC data is usage-weighted — preserve existing fetch/parse logic in `useCC`/`useAdvCC`          
  102 - `getBaseNameForCC()` must be used before any CC API call (handles forme/mega names)
  103 - Damage formula in `calcDamage()` is intentionally simplified (not smogon exact) — don't replace                                                                                                   
  104 - Showdown export must stay compatible with Pokémon Showdown paste forma