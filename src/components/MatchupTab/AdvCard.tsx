import { useRef, useState, useMemo } from "react";
import { useAppState } from "../../context/AppContext";
import { POKE_DATA } from "../../data/pokeData";
import { getMoveData } from "../../calc/moveHelpers";
import { getUsage, useUsageLoaded } from "../../hooks/useUsageData";
import {
  NATURE_DATA,
  NATURE_STATS,
  NATURE_STAT_LABELS,
  STAT_KEYS,
  STAT_LABELS,
  BOOST_OPTIONS,
  STAT_BOOST_MULTS,
} from "../../data/constants";
import {
  spriteUrl,
  itemSpriteUrl,
  getBaseNameForCC,
  getMegaOptions,
  getEffectivePokeName,
} from "../../calc/teamHelpers";
import { calcStat, getStats } from "../../calc/statCalc";
import { buildCalcCtx, calcOneMoveResult } from "../../calc/damageCalc";
import type { CalcCtx } from "../../calc/damageCalc";
import { getAbilityDesc } from "../../hooks/useAbilityDesc";
import { getItemList } from "../../hooks/useItemDesc";
import { getMoveDesc } from "../../hooks/useMoveMeta";
import { extractName } from "../../hooks/useCC";
import { useAdvCC } from "../../hooks/useAdvCC";
import SearchSelect from "../TeamPanel/SearchSelect";
import type { SearchOption } from "../TeamPanel/SearchSelect";
import type { StatMap, AdvOverride, TeamSlot, BoostMap } from "../../types";

type AdvStatKey = "sp_hp" | "sp_df" | "sp_sd" | "sp_sp" | "sp_at" | "sp_sa";
const STAT_KEY_MAP: Record<string, AdvStatKey> = {
  hp: "sp_hp",
  at: "sp_at",
  df: "sp_df",
  sa: "sp_sa",
  sd: "sp_sd",
  sp: "sp_sp",
};

interface AdvStatItemProps {
  pokeName: string;
  statKey: string;
  statLabel: string;
  spValue: number;
  boostValue: number;
  baseStat: number;
  natPlus: string;
  natMinus: string;
  baseStatChange?: number;
  baseStatDiff?: number;
}

function AdvStatItem({
  pokeName,
  statKey,
  statLabel,
  spValue,
  boostValue,
  baseStat,
  natPlus,
  natMinus,
  baseStatChange = 0,
  baseStatDiff = 0,
}: AdvStatItemProps) {
  const { dispatch } = useAppState();
  const spValRef = useRef<HTMLSpanElement>(null);

  const rawTotal =
    statKey === "hp"
      ? calcStat(baseStat, spValue, ["", ""], "hp")
      : calcStat(
          baseStat,
          spValue,
          [natPlus, natMinus],
          statKey as "at" | "df" | "sa" | "sd" | "sp",
        );
  const boostStr = boostValue > 0 ? "+" + boostValue : String(boostValue);
  const boostClass =
    boostValue > 0 ? " boosted" : boostValue < 0 ? " dropped" : "";
  const computedTotal =
    statKey !== "hp"
      ? Math.floor(rawTotal * (STAT_BOOST_MULTS[boostStr] ?? 1))
      : rawTotal;

  function step(delta: number, e: React.UIEvent) {
    e.stopPropagation();
    e.preventDefault();
    const next = Math.max(0, Math.min(32, spValue + delta));
    if (next !== spValue)
      dispatch({
        type: "SET_ADV_STAT",
        pokeName,
        statKey: STAT_KEY_MAP[statKey],
        value: next,
      });
  }

  function commit() {
    if (!spValRef.current) return;
    const val = Math.max(
      0,
      Math.min(32, parseInt(spValRef.current.textContent || "0") || 0),
    );
    spValRef.current.textContent = String(val);
    dispatch({
      type: "SET_ADV_STAT",
      pokeName,
      statKey: STAT_KEY_MAP[statKey],
      value: val,
    });
  }

  function handleBoostChange(e: React.ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation();
    const val = e.target.value === "0" ? 0 : parseInt(e.target.value);
    dispatch({ type: "SET_ADV_BOOST", pokeName, statKey, value: val });
  }

  return (
    <div className="stat-item">
      <span className="stat-label">{statLabel}</span>
      <span className="base-stat-ref">{baseStat}</span>
      <div className="sp-spinner">
        <div className="sp-btn-row">
          <button className="sp-btn" onClick={(e) => step(1, e)}>
            ▲
          </button>
          <button
            className="sp-btn-extreme"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              dispatch({
                type: "SET_ADV_STAT",
                pokeName,
                statKey: STAT_KEY_MAP[statKey],
                value: 32,
              });
            }}
          >
            ⇑
          </button>
        </div>
        <div className="sp-val-wrap">
          <span
            ref={spValRef}
            className="stat-val"
            contentEditable
            suppressContentEditableWarning
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLElement).blur();
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              (e.target as HTMLElement).textContent = "";
            }}
            onWheel={(e) => step(e.deltaY < 0 ? 1 : -1, e)}
          >
            {spValue}
          </span>
        </div>
        <div className="sp-btn-row">
          <button className="sp-btn" onClick={(e) => step(-1, e)}>
            ▼
          </button>
          <button
            className="sp-btn-extreme"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              dispatch({
                type: "SET_ADV_STAT",
                pokeName,
                statKey: STAT_KEY_MAP[statKey],
                value: 0,
              });
            }}
          >
            ▼▼
          </button>
        </div>
        <span
          className={
            "stat-total" +
            (baseStatChange > 0
              ? " stat-up"
              : baseStatChange < 0
                ? " stat-down"
                : "")
          }
        >
          {computedTotal}
          {baseStatDiff !== 0 && (
            <span className="stat-diff">
              ({baseStatDiff > 0 ? "+" : ""}
              {baseStatDiff})
            </span>
          )}
        </span>
        {statKey !== "hp" && (
          <select
            className={"stat-boost-sel" + boostClass}
            value={boostStr}
            onChange={handleBoostChange}
            onClick={(e) => e.stopPropagation()}
          >
            {BOOST_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v === "0" ? "±0" : v}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

interface AdvMoveSlotProps {
  pokeName: string;
  moveIdx: number;
  value: string;
  options: SearchOption[];
  calcCtx?: CalcCtx | null;
}

function AdvMoveSlot({
  pokeName,
  moveIdx,
  value,
  options,
  calcCtx,
}: AdvMoveSlotProps) {
  const { dispatch } = useAppState();
  const md = value ? getMoveData(value) : null;
  const dotColor = md ? `var(--${md.type})` : "var(--muted)";

  function getDamage(moveName: string): string | undefined {
    if (!calcCtx || !moveName) return undefined;
    const r = calcOneMoveResult(moveName, calcCtx);
    if (!r || r.maxPct === 0) return undefined;
    if (r.minPct >= 100) return "OHKO";
    const min = (Math.floor(r.minPct * 10) / 10).toFixed(1);
    const max = (Math.floor(r.maxPct * 10) / 10).toFixed(1);
    return min === max ? `${min}%` : `${min}~${max}%`;
  }

  return (
    <div className="move-slot">
      <div className="move-type-dot" style={{ background: dotColor }} />
      <SearchSelect
        value={extractName(value as unknown)}
        options={options}
        onChange={(v) =>
          dispatch({ type: "SET_ADV_MOVE", pokeName, moveIdx, value: v })
        }
        placeholder="(Aucun)"
        getDescription={getMoveDesc}
        getMeta={calcCtx ? getDamage : undefined}
      />
    </div>
  );
}

const POKE_NAMES_ADV = Object.keys(POKE_DATA).filter(
  (n) =>
    !n.startsWith("Mega ") &&
    n !== "Aegislash-Shield" &&
    n !== "Aegislash-Blade",
);

const NAT_PLUS_OPTIONS: SearchOption[] = NATURE_STATS.map((s) => ({
  value: s,
  label: `${NATURE_STAT_LABELS[s]} +10%`,
}));
const NAT_MINUS_OPTIONS: SearchOption[] = NATURE_STATS.map((s) => ({
  value: s,
  label: `${NATURE_STAT_LABELS[s]} -10%`,
}));

export default function AdvCard() {
  const { state, dispatch } = useAppState();
  const pokeName = state.matchupAdvName || "";
  const {
    ccAbilities,
    ccMoves,
    ccItems,
    ccNature,
    ccSps,
    allAbilities,
    isLoaded,
  } = useAdvCC(pokeName);
  const [copied, setCopied] = useState(false);

  const usageLoaded = useUsageLoaded();
  const advPokeOptions = useMemo(() => {
    const sorted = [...POKE_NAMES_ADV].sort((a, b) => {
      const ua = getUsage(a);
      const ub = getUsage(b);
      if (ub !== ua) return ub - ua;
      return a.localeCompare(b);
    });
    return sorted.map((n) => {
      const u = getUsage(n);
      return {
        value: n,
        label: n,
        meta: u > 0 ? `${Math.floor(u * 10) / 10}%` : undefined,
        image: spriteUrl(n),
      };
    });
  }, [usageLoaded]);

  const baseName = getBaseNameForCC(pokeName);
  const isMegaRow = pokeName !== baseName;
  const isAegislash =
    pokeName === "Aegislash" || pokeName === "Aegislash-Blade";
  const advPokeData = pokeName ? POKE_DATA[pokeName] : null;

  const adv = state.advStats[pokeName] || {};
  const advBoosts = state.advBoosts[pokeName] || {};
  const baseAdvPokeData = isMegaRow ? POKE_DATA[baseName] : null;
  const teamSlot =
    state.selectedSlot != null ? state.team[state.selectedSlot] : null;

  function getBaseStatChange(key: string): number {
    if (!advPokeData || !baseAdvPokeData) return 0;
    const base = (baseAdvPokeData.bs as Record<string, number>)[key] || 0;
    const current = (advPokeData.bs as Record<string, number>)[key] || 0;
    return current > base ? 1 : current < base ? -1 : 0;
  }

  function getBaseStatDiff(key: string): number {
    if (!advPokeData || !baseAdvPokeData) return 0;
    const base = (baseAdvPokeData.bs as Record<string, number>)[key] || 0;
    const current = (advPokeData.bs as Record<string, number>)[key] || 0;
    return current - base;
  }
  const spMap: Record<string, number> = {
    hp: adv.sp_hp ?? 0,
    at: adv.sp_at ?? 0,
    df: adv.sp_df ?? 0,
    sa: adv.sp_sa ?? 0,
    sd: adv.sp_sd ?? 0,
    sp: adv.sp_sp ?? 0,
  };
  const advNatPlus = adv.natPlus || "";
  const advNatMinus = adv.natMinus || "";
  const advAbility = extractName((adv.ability as unknown) || "");
  const advMoves = state.advMoves[pokeName] ?? ["", "", "", ""];
  const advItem =
    extractName((state.advItems[pokeName] as unknown) || "") || "(No Item)";

  const advAsAtkCtx = useMemo(() => {
    if (!advPokeData || !teamSlot?.pokemon) return null;
    const defEffName = getEffectivePokeName(teamSlot);
    const defPokeData = POKE_DATA[defEffName];
    if (!defPokeData) return null;
    const advSps: StatMap = {
      hp: spMap.hp ?? 0,
      at: spMap.at ?? 0,
      df: spMap.df ?? 0,
      sa: spMap.sa ?? 0,
      sd: spMap.sd ?? 0,
      sp: spMap.sp ?? 0,
    };
    const advAtkStats = getStats(advPokeData, advSps, advNatPlus, advNatMinus);
    const pseudoSlot: Partial<TeamSlot> = {
      pokemon: isMegaRow ? baseName : pokeName,
      megaForme: isMegaRow ? pokeName : "",
      ability: advAbility || advPokeData.ab || "",
      item: advItem,
      boosts: advBoosts as BoostMap,
    };
    const teamOverride: Partial<AdvOverride> = {
      sp_hp: teamSlot.sps.hp ?? 0,
      sp_at: teamSlot.sps.at ?? 0,
      sp_df: teamSlot.sps.df ?? 0,
      sp_sa: teamSlot.sps.sa ?? 0,
      sp_sd: teamSlot.sps.sd ?? 0,
      sp_sp: teamSlot.sps.sp ?? 0,
      natPlus: teamSlot.natPlus,
      natMinus: teamSlot.natMinus,
      ability: teamSlot.ability,
    };
    return buildCalcCtx(
      pseudoSlot as TeamSlot,
      advAtkStats,
      defPokeData,
      teamOverride,
      state.weather,
      state.terrain,
    );
  }, [
    pokeName,
    advAbility,
    advItem,
    advNatPlus,
    advNatMinus,
    isMegaRow,
    baseName,
    spMap.hp,
    spMap.at,
    spMap.df,
    spMap.sa,
    spMap.sd,
    spMap.sp,
    advBoosts,
    teamSlot?.pokemon,
    teamSlot?.megaForme,
    teamSlot?.ability,
    teamSlot?.item,
    teamSlot?.natPlus,
    teamSlot?.natMinus,
    teamSlot?.sps.hp,
    teamSlot?.sps.at,
    teamSlot?.sps.df,
    teamSlot?.sps.sa,
    teamSlot?.sps.sd,
    teamSlot?.sps.sp,
    state.weather,
    state.terrain,
  ]);

  const megaOwnAbility = isMegaRow ? (POKE_DATA[pokeName]?.ab ?? "") : "";
  const megaOwnAbilities = useMemo(
    () => (isMegaRow && megaOwnAbility ? [megaOwnAbility] : []),
    [isMegaRow, megaOwnAbility],
  );
  const allKnownAbilities = isMegaRow ? megaOwnAbilities : allAbilities;

  function fmt(pct: number) {
    return (Math.floor(pct * 10) / 10).toFixed(1);
  }

  const abilityOptions: SearchOption[] = useMemo(() => {
    if (isMegaRow) {
      return megaOwnAbilities.map((a) => ({
        value: a,
        label: a,
        description: getAbilityDesc(a),
      }));
    }
    const ccSet = new Set(
      ccAbilities.map((c) => extractName(c.ability.name as unknown)),
    );
    const extra = allAbilities
      .filter((a) => !ccSet.has(a))
      .map((a) => ({ value: a, label: a, description: getAbilityDesc(a) }));
    return [
      ...ccAbilities.map((c) => {
        const abilityName = extractName(c.ability.name as unknown);
        return {
          value: abilityName,
          label: abilityName,
          meta:
            c.percent > 0
              ? `${(Math.floor(c.percent * 10) / 10).toFixed(1)}%`
              : undefined,
          description: getAbilityDesc(abilityName),
        };
      }),
      ...extra,
    ];
  }, [isMegaRow, ccAbilities, megaOwnAbilities, allAbilities]);

  const currentAbility =
    advAbility ||
    (isMegaRow
      ? megaOwnAbilities[0]
      : extractName(ccAbilities[0]?.ability?.name as unknown)) ||
    allKnownAbilities[0] ||
    advPokeData?.ab ||
    "";

  const topMoves = useMemo(() => {
    if (pokeName === "Mega Charizard X") {
      const protect: typeof ccMoves = [];
      const offensive: typeof ccMoves = [];
      const dragonDance: typeof ccMoves = [];
      for (const m of ccMoves) {
        const n = extractName(m.move.name as unknown);
        if (n === "Protect") protect.push(m);
        else if (n === "Dragon Dance") dragonDance.push(m);
        else if (getMoveData(n)?.category === "Physical") offensive.push(m);
      }
      return [...protect, ...offensive, ...dragonDance].slice(0, 4);
    }
    if (pokeName === "Mega Charizard Y") {
      const offensive: typeof ccMoves = [];
      const status: typeof ccMoves = [];
      for (const m of ccMoves) {
        const cat = getMoveData(extractName(m.move.name as unknown))?.category;
        if (cat === "Special") offensive.push(m);
        else if (cat === "Status") status.push(m);
      }
      return [...offensive, ...status].slice(0, 4);
    }
    return ccMoves.slice(0, 4);
  }, [pokeName, ccMoves]);

  const moveOptions: SearchOption[] = useMemo(
    () =>
      ccMoves.map((m) => {
        const moveName = extractName(m.move.name as unknown);
        return {
          value: moveName,
          label: moveName,
          meta: m.percent > 0 ? `${fmt(m.percent)}%` : undefined,
          description: getMoveDesc(moveName),
        };
      }),
    [ccMoves],
  );

  const megaOptions = getMegaOptions(baseName);
  const hasCCData = ccAbilities.length > 0 || ccMoves.length > 0;

  const itemOptions: SearchOption[] = useMemo(() => {
    const allItems = getItemList();
    const ccItemNameSet = new Set(
      ccItems.map((i) => extractName(i.item.name as unknown)),
    );
    return [
      { value: "(No Item)", label: "(No Item)" },
      ...ccItems.map((i) => {
        const itemName = extractName(i.item.name as unknown);
        return {
          value: itemName,
          label: itemName,
          image: itemSpriteUrl(itemName),
          meta: i.percent > 0 ? `${fmt(i.percent)}%` : undefined,
        };
      }),
      ...allItems
        .filter((it) => !ccItemNameSet.has(it))
        .map((it) => ({ value: it, label: it, image: itemSpriteUrl(it) })),
    ];
  }, [ccItems]);

  function handleApplyCommonSet() {
    const topAbility = isMegaRow
      ? megaOwnAbilities[0] || ""
      : extractName(ccAbilities[0]?.ability?.name as unknown) ||
        allKnownAbilities[0] ||
        "";
    const topItem =
      extractName(ccItems[0]?.item?.name as unknown) || "(No Item)";
    const moves4: [string, string, string, string] = ["", "", "", ""];
    topMoves.slice(0, 4).forEach((m, i) => {
      moves4[i] = extractName(m.move.name as unknown);
    });
    dispatch({
      type: "APPLY_ADV_COMMON",
      pokeName,
      ccAbility: topAbility,
      ccItem: topItem,
      ccNatPlus: ccNature?.natPlus || "",
      ccNatMinus: ccNature?.natMinus || "",
      ccSps: ccSps ?? null,
      ccMoves: moves4,
    });
  }

  const t1 = advPokeData?.t1;
  const t2 = advPokeData?.t2;

  function buildShowdownText(): string {
    const natureName =
      Object.entries(NATURE_DATA).find(
        ([, [p, m]]) =>
          p === advNatPlus && m === advNatMinus && (p !== "" || m !== ""),
      )?.[0] ?? "Hardy";

    const EV_LABELS: Record<string, string> = {
      hp: "HP",
      at: "Atk",
      df: "Def",
      sa: "SpA",
      sd: "SpD",
      sp: "Spe",
    };
    const evParts = (["hp", "at", "df", "sa", "sd", "sp"] as const)
      .map((k) => ({ key: k, val: spMap[k] ?? 0 }))
      .filter(({ val }) => val > 0)
      .map(({ key, val }) => `${val} ${EV_LABELS[key]}`);
    const evLine = evParts.length ? `EVs: ${evParts.join(" / ")}\n` : "";

    const item = advItem !== "(No Item)" ? advItem : "";
    const itemLine = item ? ` @ ${item}` : "";
    const moves = advMoves
      .map((m) => extractName(m as unknown))
      .filter(Boolean)
      .map((m) => `- ${m}`)
      .join("\n");

    const notes = (state.slotNotes[state.selectedSlot ?? 0] || "").trim();
    const notesBlock = notes
      ? "\n" +
        notes
          .split("\n")
          .map((l) => `// ${l}`)
          .join("\n")
      : "";

    return `${pokeName}${itemLine}\nAbility: ${currentAbility || ""}\nLevel: 50\n${evLine}${natureName} Nature\n${moves}${notesBlock}`;
  }

  function handleExportShowdown() {
    navigator.clipboard
      .writeText(buildShowdownText())
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  return (
    <div className="pokemon-card">
      {advPokeData && (
        <div className="card-header">
          <img
            className="card-sprite"
            src={spriteUrl(pokeName)}
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <span className="poke-name-display">{pokeName}</span>
          {t1 && (
            <span className="type-badge" style={{ background: `var(--${t1})` }}>
              {t1}
            </span>
          )}
          {t2 && (
            <span className="type-badge" style={{ background: `var(--${t2})` }}>
              {t2}
            </span>
          )}
        </div>
      )}

      {(isAegislash || megaOptions || hasCCData) && pokeName && (
        <div className="mega-bar">
          {isAegislash && (
            <>
              <span className="mega-label">Formes :</span>
              <button
                className={
                  "mega-btn" + (pokeName === "Aegislash" ? " active" : "")
                }
                onClick={() =>
                  dispatch({ type: "SET_MATCHUP_ADV", pokeName: "Aegislash" })
                }
              >
                Shield
              </button>
              <button
                className={
                  "mega-btn" + (pokeName === "Aegislash-Blade" ? " active" : "")
                }
                onClick={() =>
                  dispatch({
                    type: "SET_MATCHUP_ADV",
                    pokeName: "Aegislash-Blade",
                  })
                }
              >
                Blade
              </button>
            </>
          )}
          {megaOptions && (
            <>
              <span className="mega-label">Formes :</span>
              <button
                className={"mega-btn" + (!isMegaRow ? " active" : "")}
                onClick={() =>
                  dispatch({ type: "SET_MATCHUP_ADV", pokeName: baseName })
                }
              >
                Base
              </button>
              {Object.keys(megaOptions).map((mf) => (
                <button
                  key={mf}
                  className={"mega-btn" + (pokeName === mf ? " active" : "")}
                  onClick={() =>
                    dispatch({ type: "SET_MATCHUP_ADV", pokeName: mf })
                  }
                >
                  {mf}
                </button>
              ))}
            </>
          )}
          {hasCCData && (
            <button
              className="mega-btn"
              style={{ marginLeft: "auto" }}
              onClick={handleApplyCommonSet}
            >
              Most Common Set
            </button>
          )}
        </div>
      )}

      <div className="card-selects">
        <div className="card-selects-full">
          <SearchSelect
            value={baseName}
            options={advPokeOptions}
            onChange={(name) =>
              dispatch({ type: "SET_MATCHUP_ADV", pokeName: name })
            }
            placeholder="— Choisir adversaire —"
            maxUnfiltered={60}
          />
        </div>
        {advPokeData && (
          <>
            <SearchSelect
              value={currentAbility}
              options={abilityOptions}
              onChange={(v) =>
                dispatch({ type: "SET_ADV_ABILITY", pokeName, value: v })
              }
              placeholder="— Talent —"
              getDescription={getAbilityDesc}
              disabled={abilityOptions.length <= 1}
              className="search-select--fixed"
            />
            <SearchSelect
              value={advItem}
              options={itemOptions}
              onChange={(v) =>
                dispatch({ type: "SET_ADV_ITEM", pokeName, value: v })
              }
              className="search-select--fixed"
            />
            <SearchSelect
              value={advNatPlus}
              options={NAT_PLUS_OPTIONS}
              onChange={(v) =>
                dispatch({
                  type: "SET_ADV_NATURE",
                  pokeName,
                  field: "natPlus",
                  value: v,
                })
              }
              placeholder="(Neutre)"
            />
            <SearchSelect
              value={advNatMinus}
              options={NAT_MINUS_OPTIONS}
              onChange={(v) =>
                dispatch({
                  type: "SET_ADV_NATURE",
                  pokeName,
                  field: "natMinus",
                  value: v,
                })
              }
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
                boostValue={advBoosts[key] ?? 0}
                baseStat={(advPokeData.bs as Record<string, number>)[key] ?? 0}
                natPlus={advNatPlus}
                natMinus={advNatMinus}
                baseStatChange={getBaseStatChange(key)}
                baseStatDiff={getBaseStatDiff(key)}
              />
            ))}
          </div>
          <div className="moves-section">
            <div className="moves-label">Attaques</div>
            {advMoves.map((mv, mi) => {
              const otherSelected = new Set(
                advMoves.filter((m, i) => i !== mi && m),
              );
              const available = moveOptions.filter(
                (o) => !otherSelected.has(o.value),
              );
              return (
                <AdvMoveSlot
                  key={mi}
                  pokeName={pokeName}
                  moveIdx={mi}
                  value={mv}
                  options={available}
                  calcCtx={advAsAtkCtx}
                />
              );
            })}
          </div>
        </>
      )}

      {pokeName && (
        <button
          className={"export-showdown-btn" + (copied ? " copied" : "")}
          onClick={handleExportShowdown}
          title="Exporter vers Pokémon Showdown"
        >
          {copied ? "✓ Copié !" : "Export Showdown"}
        </button>
      )}
    </div>
  );
}
