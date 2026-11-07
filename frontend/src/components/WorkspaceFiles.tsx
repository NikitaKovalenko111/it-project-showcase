import { useState } from 'react'
import { FileText } from 'lucide-react'
import type { Execution } from '../types/execution'
import { FileDownload } from './FileDownload'

export function WorkspaceFiles({ entries }: { entries: Execution[] }) {
  const [executionId, setExecutionId] = useState('')
  const groups = entries.flatMap((entry) => {
    const files = [
      ...(entry.milestones || []).flatMap((stage) =>
        stage.attachedMaterials.map((file) => ({ file, context: stage.title, sourceId: stage.id })),
      ),
      ...(entry.submission?.attachedFiles || []).map((file) => ({
        file,
        context: 'Итоговое решение',
        sourceId: 'final',
      })),
    ]
    return files.length ? [{ entry, files }] : []
  })
  const selected = groups.some((group) => group.entry.id === executionId) ? executionId : ''
  const visible = groups.filter((group) => !selected || group.entry.id === selected)
  const count = groups.reduce((sum, group) => sum + group.files.length, 0)

  return (
    <section className="workspace-files" aria-labelledby="workspace-files-title">
      <div className="feature-toolbar">
        <h3 id="workspace-files-title">
          Прикреплённые файлы <span className="badge badge-direction">{count}</span>
        </h3>
        {groups.length > 1 && (
          <select
            className="select"
            aria-label="Файлы команды или участника"
            value={selected}
            onChange={(event) => setExecutionId(event.target.value)}
          >
            <option value="">Все команды и участники</option>
            {groups.map(({ entry }) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {!count ? (
        <p className="form-hint">Файлов пока нет.</p>
      ) : (
        <ul className="workspace-files__grid">
          {visible.flatMap(({ entry, files }) =>
            files.map(({ file, context, sourceId }, index) => (
              <li key={`${entry.id}:${sourceId}:${index}`}>
                <FileText size={20} aria-hidden="true" />
                <div>
                  <FileDownload file={file} className="workspace-files__download" />
                  <small>
                    {entry.name} · {context}
                  </small>
                </div>
              </li>
            )),
          )}
        </ul>
      )}
    </section>
  )
}
