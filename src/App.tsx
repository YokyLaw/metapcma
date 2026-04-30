'use client'

import { useState } from 'react'
import { AppProvider } from './context/AppContext'
import { useCalc } from './hooks/useCalc'
import Header from './components/Header'
import CalcSidebar from './components/CalcSidebar'
import ResultsPanel from './components/ResultsPanel/ResultsPanel'
import FieldBar from './components/FieldBar'
import TeamBuilderView from './components/TeamBuilderView'

type Tab = 'team' | 'calc'

function AppInner() {
  useCalc()
  const [tab, setTab] = useState<Tab>('team')

  return (
    <>
      <Header activeTab={tab} onTabChange={setTab} />
      {tab === 'team' ? (
        <TeamBuilderView />
      ) : (
        <div className="app">
          <CalcSidebar />
          <ResultsPanel />
          <FieldBar />
        </div>
      )}
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
