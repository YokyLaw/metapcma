import { useEffect } from 'react'
import { AppProvider } from './context/AppContext'
import { prefetchAll } from './hooks/useCC'
import { useCalc } from './hooks/useCalc'
import Header from './components/Header'
import FieldBar from './components/FieldBar'
import TeamPanel from './components/TeamPanel/TeamPanel'
import ResultsPanel from './components/ResultsPanel/ResultsPanel'
import './styles/globals.css'

function AppInner() {
  useCalc()
  useEffect(() => { prefetchAll() }, [])

  return (
    <>
      <Header />
      <div className="app">
        <FieldBar />
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
