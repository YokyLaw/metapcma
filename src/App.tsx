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
import TeamBuilderView from './components/TeamBuilderView'
import MatchupTab from './components/MatchupTab/MatchupTab'
import NewTeamBuilder from './components/NewTeamBuilder'

function AppInner() {
  useCalc()
  useEffect(() => { prefetchItemDescs(); prefetchAbilityDescs(); prefetchMoveMeta(); prefetchUsageData() }, [])
  const [tab, setTab] = useState<Tab>('new-team')

  return (
    <>
      <Header activeTab={tab} onTabChange={setTab} />
      {tab === 'new-team' && <NewTeamBuilder />}
      {tab === 'archive' && <TeamBuilderView />}
      {tab === 'calc' && (
        <div className="matchup-root">
          <div className="matchup-layout">
            <CalcSidebar />
            <div className="matchup-middle">
              <ResultsPanel />
            </div>
          </div>
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
