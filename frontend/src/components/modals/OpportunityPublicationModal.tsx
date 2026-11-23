import { clearFieldError, markFieldError, reportFieldError } from '../../utils/formValidation'
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
  allowCompanySelection = false,
  onCompanyChange,
  formatControl,
  embedded = false,
  onBusyChange,
  onClose,
  onSaved,
}: {
  initial: Partial<Opportunity> & { kind: OpportunityKind }
  companies: Pick<Company, 'id' | 'name'>[]
  allowCompanySelection?: boolean
  onCompanyChange?: (companyId: string) => void
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
  const companyName =
    companies.find((company) => company.id === editor.company_id)?.name || editor.company_name || ''
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
        onInput={clearFieldError}
        onInvalid={markFieldError}
        onSubmit={async (event) => {
          event.preventDefault()
          if (busy) return
          const submit =
            (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') !== 'draft'
          const form = event.currentTarget
          for (const [name, label] of [
            ['title', 'название'],
            ['summary', 'краткое описание'],
          ]) {
            if (!String(new FormData(form).get(name) || '').trim()) {
              reportFieldError(form, name, `Заполните ${label}.`)
              return
            }
          }
          const deadlineField = form.elements.namedItem('application_deadline') as HTMLInputElement
          const applicationDeadline = deadlineField.value
          const content = event.currentTarget.querySelector(
            'textarea[aria-labelledby="opportunity-program-label"]',
          ) as HTMLTextAreaElement | null
          if (!editor.content_markdown?.trim()) {
            content?.setCustomValidity('Заполните программу и условия участия.')
            content?.reportValidity()
            return
          }
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
              application_deadline: applicationDeadline
                ? new Date(`${applicationDeadline}T23:59:59`).toISOString()
                : null,
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
            <label className="publication-company-field">
              Компания
              {allowCompanySelection && !editor.program_id ? (
                <select
                  className="select"
                  name="company_id"
                  title={companyName || undefined}
                  required
                  value={editor.company_id || ''}
                  onChange={(event) => {
                    const company_id = event.target.value
                    setEditor((current) => ({ ...current, company_id }))
                    onCompanyChange?.(company_id)
                  }}
                >
                  <option value="">Выберите компанию</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  readOnly
                  title={companyName || undefined}
                  value={companyName}
                />
              )}
            </label>
            <label>
              Название
              <input
                className="input"
                required
                name="title"
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
                name="summary"
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
                  name="application_deadline"
                  max="2100-12-31"
                  defaultValue={
                    editor.application_deadline
                      ? new Date(editor.application_deadline).toLocaleDateString('sv-SE')
                      : ''
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
                  name: 'content_markdown',
                  maxLength: 15000,
                  onInput: (event) => event.currentTarget.setCustomValidity(''),
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
            <button className="btn btn-secondary" value="draft" disabled={busy}>
              Сохранить черновик
            </button>
          )}
          <button className="btn btn-primary" disabled={busy}>
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
