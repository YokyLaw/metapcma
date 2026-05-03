'use client'

import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from 'react'
import { appReducer, initialState, type AppState, type Action } from './reducer'

const STORAGE_KEY = 'metapcma_state'

const PERSIST_KEYS: (keyof AppState)[] = [
  'team', 'selectedSlot', 'weather', 'terrain', 'tailwind',
  'advStats', 'sortKey', 'sortAsc', 'filterType', 'filterKO',
  'showLowUsage', 'favorites', 'matchupAdvName', 'slotNotes',
  'advMoves', 'advItems', 'advAutoSet', 'advPreAutoSet', 'advBoosts',
]

interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<Action>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const hasMounted = useRef(false)

  // Save — defined FIRST so it runs before load effect on initial flush
  useEffect(() => {
    if (!hasMounted.current) return
    const toPersist = Object.fromEntries(PERSIST_KEYS.map(k => [k, state[k]])) as Partial<AppState>
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist)) } catch { /* quota */ }
  }, [state])

  // Load — defined SECOND; sets hasMounted before dispatching to prevent premature save
  useEffect(() => {
    hasMounted.current = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) dispatch({ type: 'LOAD_STATE', payload: JSON.parse(raw) as Partial<AppState> })
    } catch { /* corrupt */ }
  }, [])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppState(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppState must be used within AppProvider')
  return ctx
}
