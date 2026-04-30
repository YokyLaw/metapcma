import '../styles/header.css'

type Tab = 'team' | 'calc'

interface Props {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export default function Header({ activeTab, onTabChange }: Props) {
  return (
    <header>
      <div>
        <h1>Champions Calc</h1>
        <div className="subtitle">VGC 2026 · Régulation MA · Stat Points System</div>
      </div>
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
      </nav>
      <div className="header-badge">REG MA</div>
    </header>
  )
}
