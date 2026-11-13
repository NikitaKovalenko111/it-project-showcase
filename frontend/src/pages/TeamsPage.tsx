import React, { useState } from 'react'
import { TeamsPanel } from '../components/TeamsPanel'
export const TeamsPage: React.FC = () => {
  const [view, setView] = useState<'teams' | 'requests' | 'search'>('teams')
  return (
    <div className="teams-layout">
      <div className="page-header">
        <div className="page-header__content">
          <h1>Команды</h1>
          <p>Составы команд, приглашения и поиск участников.</p>
        </div>
      </div>
      <div className="uust-container attached-tabs">
        <nav className="uust-tabs-row mobile-wrap-tabs" aria-label="Разделы команд">
          {(
            [
              ['teams', 'Составы команд'],
              ['requests', 'Заявки и приглашения'],
              ['search', 'Найти команду'],
            ] as const
          ).map(([id, label]) => (
            <button
              type="button"
              key={id}
              className={`uust-tab ${view === id ? 'active' : ''}`}
              aria-pressed={view === id}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="uust-box">
          <TeamsPanel
            key={view}
            searchMode={view === 'search'}
            initialView={view === 'requests' ? 'requests' : 'teams'}
          />
        </div>
      </div>
    </div>
  )
}
