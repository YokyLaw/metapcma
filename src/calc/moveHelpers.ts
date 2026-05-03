import type { MoveEntry } from '../types'
import { MOVE_DATA } from '../data/moveData'
import { getMoveMeta } from '../hooks/useMoveMeta'

export function getMoveData(name: string): MoveEntry | undefined {
  const staticMd = MOVE_DATA[name]
  const apiMeta = getMoveMeta(name)
  if (!staticMd && !apiMeta) return undefined
  if (!apiMeta) return staticMd
  if (!staticMd) {
    return {
      type: apiMeta.type || 'Normal',
      category: apiMeta.category as MoveEntry['category'] || 'Physical',
      bp: apiMeta.bp ?? 0,
      isPriority: apiMeta.isPriority,
      isBullet: apiMeta.isBullet,
      isBite: apiMeta.isBite,
    }
  }
  return {
    ...staticMd,
    isPriority: apiMeta.isPriority || staticMd.isPriority || false,
    isBullet: apiMeta.isBullet || staticMd.isBullet || false,
    isBite: apiMeta.isBite || staticMd.isBite || false,
  }
}
