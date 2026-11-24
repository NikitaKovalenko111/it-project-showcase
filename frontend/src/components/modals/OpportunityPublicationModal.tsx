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
import { localDate } from '../../utils/date'

export type { Opportunity, OpportunityKind } from '../../api/opportunities'

export function OpportunityPublicationModal({
  initial,
  companies,
  allowCompanySelection = false,
  companyUnavailable,
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
  companyUnavailable?: string
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
  const companyId =
    editor.program_id || allowCompanySelection ? editor.company_id : initial.company_id
  const companyName =
    companies.find((company) => company.id === companyId)?.name || editor.company_name || ''
  const [selectedDeadline, setSelectedDeadline] = useState(() =>
    initial.application_deadline
      ? new Date(initial.application_deadline).toLocaleDateString('sv-SE')
      : '',
  )
  const today = localDate()
  const deadlineError =
    selectedDeadline &&
    selectedDeadline < today &&
    (!initial.application_deadline ||
      selectedDeadline !== new Date(initial.application_deadline).toLocaleDateString('sv-SE'))
      ? 'Срок подачи заявок не может быть в прошлом.'
      : ''
  const byteLength = (value?: string) => new TextEncoder().encode(value?.trim() || '').length
  const titleError = byteLength(editor.title) > 200 ? 'Название превышает 200 байт.' : ''
  const summaryError =
    byteLength(editor.summary) > 1000 ? 'Краткое описание превышает 1 000 байт.' : ''
  const contentError =
    byteLength(editor.content_markdown) > 50000 ? 'Программа превышает 50 000 байт.' : ''
  const capacityError =
    editor.capacity &&
    (editor.capacity < 1 || editor.capacity > 10000 || !Number.isInteger(editor.capacity))
      ? 'Укажите целое число от 1 до 10 000.'
      : ''
  const hasFieldErrors = !!(
    titleError ||
    summaryError ||
    contentError ||
    capacityError ||
    deadlineError
  )
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
          if (busy || companyUnavailable) return
          const submit =
            (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') !== 'draft'
          const form = event.currentTarget
          if (hasFieldErrors) {
            form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
            return
          }
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
              company_id: companyId,
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
                  value={companyId || ''}
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
              {companyUnavailable && (
                <span className="form-hint" role="status">
                  {companyUnavailable}
                </span>
              )}
            </label>
            <label>
              Название
              <span className="form-hint" id="opportunity-title-limit">
                До 200 байт
              </span>
              <input
                className="input"
                required
                name="title"
                aria-describedby="opportunity-title-limit"
                aria-invalid={titleError ? true : undefined}
                value={editor.title || ''}
                onChange={(event) => setEditor({ ...editor, title: event.target.value })}
              />
              {titleError && (
                <span className="publication-field-error" role="alert">
                  {titleError}
                </span>
              )}
            </label>
            <label>
              Краткое описание
              <span className="form-hint" id="opportunity-summary-limit">
                До 1 000 байт
              </span>
              <textarea
                className="textarea"
                required
                name="summary"
                rows={2}
                aria-describedby="opportunity-summary-limit"
                aria-invalid={summaryError ? true : undefined}
                value={editor.summary || ''}
                onChange={(event) => setEditor({ ...editor, summary: event.target.value })}
              />
              {summaryError && (
                <span className="publication-field-error" role="alert">
                  {summaryError}
                </span>
              )}
            </label>
            <div className="responsive-grid">
              <label>
                Количество мест
                <span className="form-hint">От 1 до 10 000</span>
                <input
                  className="input"
                  type="number"
                  required
                  min={1}
                  max={10000}
                  aria-invalid={capacityError ? true : undefined}
                  value={editor.capacity || ''}
                  onChange={(event) =>
                    setEditor({ ...editor, capacity: Number(event.target.value) })
                  }
                />
                {capacityError && (
                  <span className="publication-field-error" role="alert">
                    {capacityError}
                  </span>
                )}
              </label>
              <label>
                Срок подачи заявок
                <input
                  className="input"
                  type="date"
                  name="application_deadline"
                  max="2100-12-31"
                  min={
                    initial.application_deadline?.slice(0, 10) === selectedDeadline &&
                    selectedDeadline < today
                      ? selectedDeadline
                      : today
                  }
                  value={selectedDeadline}
                  aria-invalid={deadlineError ? true : undefined}
                  onChange={(event) => setSelectedDeadline(event.target.value)}
                />
                {deadlineError && (
                  <span className="publication-field-error" role="alert">
                    {deadlineError}
                  </span>
                )}
              </label>
            </div>
            <div data-color-mode="light">
              <p id="opportunity-program-label">
                Программа и условия участия <span className="form-hint">До 50 000 байт</span>
              </p>
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
                onChange={(value) => setEditor({ ...editor, content_markdown: value || '' })}
                textareaProps={{
                  'aria-labelledby': 'opportunity-program-label',
                  name: 'content_markdown',
                  'aria-invalid': contentError ? true : undefined,
                  onInput: (event) => event.currentTarget.setCustomValidity(''),
                }}
                previewOptions={{
                  rehypePlugins: [[rehypeSanitize, markdownSchema]],
                  components: { img: MarkdownImage },
                }}
              />
              {contentError && (
                <p className="publication-field-error" role="alert">
                  {contentError}
                </p>
              )}
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
              disabled={busy || !!companyUnavailable}
            >
              Сохранить черновик
            </button>
          )}
          <button className="btn btn-primary" disabled={busy || !!companyUnavailable}>
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
