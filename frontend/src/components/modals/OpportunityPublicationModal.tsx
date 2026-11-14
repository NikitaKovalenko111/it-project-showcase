import { MarkdownImageUpload } from '../MarkdownImageUpload'
import { markdownSchema, MarkdownImage } from '../RichMarkdown'
import { useState, useEffect, type ReactNode } from 'react'
import { Modal } from '../Modal'
import { X } from 'lucide-react'
import MDEditor from '@uiw/react-md-editor'
import rehypeSanitize from 'rehype-sanitize'
import { opportunityApi, type Opportunity, type OpportunityKind } from '../../api/opportunities'
import type { Company } from '../../types/models'

export type { Opportunity, OpportunityKind } from '../../api/opportunities'

export function OpportunityPublicationModal({
  initial,
  companies,
  formatControl,
  embedded = false,
  onBusyChange,
  onClose,
  onSaved,
}: {
  initial: Partial<Opportunity> & { kind: OpportunityKind }
  companies: Pick<Company, 'id' | 'name'>[]
  formatControl?: ReactNode
  embedded?: boolean
  onBusyChange?: (busy: boolean) => void
  onClose: () => void
  onSaved: (item: Opportunity, submitted: boolean) => void
}) {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 768px)').matches)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)')
    const update = () => setCompact(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const [editor, setEditor] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const title =
    (editor.program_id ? 'Редактирование ' : 'Размещение ') +
    (editor.kind === 'practice' ? 'практики' : 'стажировки')

  const content = (
    <>
      <header className="modal-dialog__header">
        <div>
          <h3>{title}</h3>
          <p>Публикация появится в витрине после модерации.</p>
        </div>
        <button
          type="button"
          className="close-btn"
          aria-label="Закрыть"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (busy) return
          const submit =
            (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') !== 'draft'
          setBusy(true)
          onBusyChange?.(true)
          setError('')
          try {
            const payload = {
              kind: editor.kind,
              company_id: editor.company_id,
              title: editor.title,
              summary: editor.summary,
              content_markdown: editor.content_markdown,
              capacity: editor.capacity,
              application_deadline: editor.application_deadline || null,
            }
            const saved = await opportunityApi.save(editor.program_id, payload)
            setEditor(saved)
            if (submit) {
              const updated = await opportunityApi.setStatus(saved.program_id, 'moderation', '')
              onSaved(updated, true)
            } else {
              onSaved(saved, false)
            }
          } catch (cause) {
            setError((cause as Error).message)
          } finally {
            setBusy(false)
            onBusyChange?.(false)
          }
        }}
      >
        <div className="modal-dialog__body">
          <fieldset className="opportunity-fields" disabled={busy}>
            {!editor.program_id && formatControl}
            <label>
              Компания
              <select
                className="select"
                required
                value={editor.company_id || ''}
                disabled={!!editor.program_id}
                onChange={(event) => setEditor({ ...editor, company_id: event.target.value })}
              >
                <option value="">Выберите компанию</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Название
              <input
                className="input"
                required
                maxLength={300}
                value={editor.title || ''}
                onChange={(event) => setEditor({ ...editor, title: event.target.value })}
              />
            </label>
            <label>
              Краткое описание
              <textarea
                className="textarea"
                required
                rows={2}
                maxLength={500}
                value={editor.summary || ''}
                onChange={(event) => setEditor({ ...editor, summary: event.target.value })}
              />
            </label>
            <div className="responsive-grid">
              <label>
                Количество мест
                <input
                  className="input"
                  type="number"
                  required
                  min={1}
                  max={10000}
                  value={editor.capacity || ''}
                  onChange={(event) =>
                    setEditor({ ...editor, capacity: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Срок подачи заявок
                <input
                  className="input"
                  type="date"
                  value={
                    editor.application_deadline
                      ? new Date(editor.application_deadline).toLocaleDateString('sv-SE')
                      : ''
                  }
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      application_deadline: event.target.value
                        ? new Date(`${event.target.value}T23:59:59`).toISOString()
                        : null,
                    })
                  }
                />
              </label>
            </div>
            <div data-color-mode="light">
              <p id="opportunity-program-label">Программа и условия участия</p>
              <MarkdownImageUpload
                onInsert={(markdown) =>
                  setEditor((value) => ({
                    ...value,
                    content_markdown: (value.content_markdown || '') + markdown,
                  }))
                }
              />
              <MDEditor
                preview={compact ? 'edit' : 'live'}
                overflow={false}
                height={200}
                value={editor.content_markdown || ''}
                onChange={(value) =>
                  setEditor({ ...editor, content_markdown: (value || '').slice(0, 15000) })
                }
                textareaProps={{
                  'aria-labelledby': 'opportunity-program-label',
                  maxLength: 15000,
                }}
                previewOptions={{
                  rehypePlugins: [[rehypeSanitize, markdownSchema]],
                  components: { img: MarkdownImage },
                }}
              />
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </fieldset>
        </div>
        <footer className="modal-dialog__footer">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
            Отмена
          </button>
          {editor.status !== 'published' && (
            <button
              className="btn btn-secondary"
              value="draft"
              disabled={busy || !editor.content_markdown?.trim()}
            >
              Сохранить черновик
            </button>
          )}
          <button className="btn btn-primary" disabled={busy || !editor.content_markdown?.trim()}>
            {busy ? 'Сохраняем…' : 'Отправить на модерацию'}
          </button>
        </footer>
      </form>
    </>
  )
  return embedded ? (
    content
  ) : (
    <Modal
      title={title}
      bare
      className="modal-dialog--lg publication-dialog"
      busy={busy}
      onClose={onClose}
    >
      {content}
    </Modal>
  )
}
