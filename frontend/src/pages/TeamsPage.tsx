import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { TeamsPanel } from '../components/TeamsPanel'
export const TeamsPage: React.FC = () => {
  const [params, setParams] = useSearchParams()
  const invitationId = params.get('invitation')
  const tab = params.get('view')
  const view =
    invitationId || tab === 'requests' ? 'requests' : tab === 'search' ? 'search' : 'teams'
  return (
    <div className="teams-layout">
      <div className="page-header">
        <div className="page-header__content">
          <h1>Команды</h1>
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
              onClick={() => setParams(id === 'teams' ? {} : { view: id })}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="uust-box">
          <TeamsPanel
            key={view + (invitationId || '')}
            invitationId={invitationId || undefined}
            searchMode={view === 'search'}
            initialView={view === 'requests' ? 'requests' : 'teams'}
          />
        </div>
      </div>
    </div>
  )
}
