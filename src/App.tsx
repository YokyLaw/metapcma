'use client'

import { AppProvider } from './context/AppContext'
import { useCalc } from './hooks/useCalc'
import Header from './components/Header'
import TeamPanel from './components/TeamPanel/TeamPanel'
import ResultsPanel from './components/ResultsPanel/ResultsPanel'

function AppInner() {
  useCalc()

  return (
    <>
      <Header />
      <div className="app">
        <TeamPanel />
        <ResultsPanel />
      </div>
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
