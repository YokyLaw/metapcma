export const NATURE_DATA: Record<string, [string, string]> = {
  "Adamant":["at","sa"],"Bashful":["",""],"Bold":["df","at"],"Brave":["at","sp"],
  "Calm":["sd","at"],"Careful":["sd","sa"],"Docile":["",""],"Gentle":["sd","df"],
  "Hardy":["",""],"Hasty":["sp","df"],"Impish":["df","sa"],"Jolly":["sp","sa"],
  "Lax":["df","sd"],"Lonely":["at","df"],"Mild":["sa","df"],"Modest":["sa","at"],
  "Naive":["sp","sd"],"Naughty":["at","sd"],"Quiet":["sa","sp"],"Quirky":["",""],
  "Rash":["sa","sd"],"Relaxed":["df","sp"],"Sassy":["sd","sp"],"Serious":["",""],
  "Timid":["sp","at"],
}

export const NATURE_STATS = ['at','df','sa','sd','sp'] as const
export const NATURE_STAT_LABELS: Record<string, string> = { at:'ATK', df:'DEF', sa:'SpA', sd:'SpD', sp:'VIT' }

export const STAT_KEYS = ['hp','at','df','sa','sd','sp'] as const
export const STAT_LABELS = ['HP','ATK','DEF','SpA','SpD','SPE'] as const
export type StatKey = typeof STAT_KEYS[number]
export type BoostKey = 'at'|'df'|'sa'|'sd'|'sp'

export const STAT_BOOST_MULTS: Record<string, number> = {
  '-6': 0.25, '-5': 0.2858, '-4': 0.3333, '-3': 0.40,
  '-2': 0.50, '-1': 0.6667,  '0': 1.0,
  '+1': 1.50, '+2': 2.0,    '+3': 2.50,
  '+4': 3.0,  '+5': 3.50,   '+6': 4.0,
}

export const BOOST_OPTIONS = ['+6','+5','+4','+3','+2','+1','0','-1','-2','-3','-4','-5','-6'] as const
export type BoostOption = typeof BOOST_OPTIONS[number]

export const WEATHER_OPTIONS = [
  { val: '', label: 'Neutre' },
  { val: 'Sun', label: 'Soleil' },
  { val: 'Rain', label: 'Pluie' },
  { val: 'Sand', label: 'Sable' },
  { val: 'Snow', label: 'Neige' },
] as const

export const TERRAIN_OPTIONS = [
  { val: '', label: 'Neutre' },
  { val: 'Electric', label: 'Élec.' },
  { val: 'Grassy', label: 'Herbeux' },
  { val: 'Psychic', label: 'Psy.' },
  { val: 'Misty', label: 'Brumeux' },
] as const

export const TYPE_NAMES = [
  'Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison',
  'Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy',
] as const
