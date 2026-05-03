'use client'

import { useState, useEffect } from 'react'
import { AppProvider } from './context/AppContext'
import { useCalc } from './hooks/useCalc'
import Header from './components/Header'
import type { Tab } from './components/Header'
import { prefetchItemDescs } from './hooks/useItemDesc'
import { prefetchAbilityDescs } from './hooks/useAbilityDesc'
import { prefetchMoveMeta } from './hooks/useMoveMeta'
import { prefetchUsageData } from './hooks/useUsageData'
import CalcSidebar from './components/CalcSidebar'
import ResultsPanel from './components/ResultsPanel/ResultsPanel'
import FieldBar from './components/FieldBar'
import TeamBuilderView from './components/TeamBuilderView'
import MatchupTab from './components/MatchupTab/MatchupTab'

function AppInner() {
  useCalc()
  useEffect(() => { prefetchItemDescs(); prefetchAbilityDescs(); prefetchMoveMeta(); prefetchUsageData() }, [])
  const [tab, setTab] = useState<Tab>('team')

  return (
    <>
      <Header activeTab={tab} onTabChange={setTab} />
      {tab === 'team' && <TeamBuilderView />}
      {tab === 'calc' && (
        <div className="app">
          <CalcSidebar />
          <ResultsPanel />
          <FieldBar />
        </div>
      )}
      {tab === 'matchup' && <MatchupTab />}
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
