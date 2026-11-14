import { useState } from 'react'
import type { Execution } from '../types/execution'
import { WorkspaceFiles } from './WorkspaceFiles'
import { ExecutionComments } from './ExecutionComments'
export function TeamDiscussion({ entries, caseId }: { entries: Execution[]; caseId: string }) {
  const [selected, setSelected] = useState('')
  const entry = entries.find((item) => item.id === selected) || entries[0]
  return (
    <section className="team-discussion">
      <header className="feature-toolbar">
        <h2>Обсуждение и файлы</h2>
        {entries.length > 1 && (
          <label>
            Команда / участник
            <select
              className="select"
              value={entry?.id || ''}
              onChange={(e) => setSelected(e.target.value)}
            >
              {entries.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      {entry ? (
        <div key={entry.id}>
          <h3>{entry.name}</h3>
          <WorkspaceFiles entries={[entry]} />
          <ExecutionComments executionId={entry.id} caseId={caseId} />
        </div>
      ) : (
        <p>Пока нет участников.</p>
      )}
    </section>
  )
}
