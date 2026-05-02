import '../styles/header.css'

export type Tab = 'team' | 'calc' | 'matchup'

interface Props {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export default function Header({ activeTab, onTabChange }: Props) {
  return (
    <header>
      <h1>Champions Calc</h1>
      <nav className="tab-nav">
        <button
          className={'tab-btn' + (activeTab === 'team' ? ' active' : '')}
          onClick={() => onTabChange('team')}
        >
          Teambuilder
        </button>
        <button
          className={'tab-btn' + (activeTab === 'calc' ? ' active' : '')}
          onClick={() => onTabChange('calc')}
        >
          Calc
        </button>
        <button
          className={'tab-btn' + (activeTab === 'matchup' ? ' active' : '')}
          onClick={() => onTabChange('matchup')}
        >
          Matchup
        </button>
      </nav>
      <div className="header-badge">REG MA</div>
    </header>
  )
}
