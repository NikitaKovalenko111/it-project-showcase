import { clearFieldError, markFieldError, reportFieldError } from '../../utils/formValidation'
import { markdownImageLink, MarkdownImageUpload } from '../MarkdownImageUpload'
import { ProgramMarkdownImage } from '../ProgramMarkdownImage'
import { markdownSchema } from '../RichMarkdown'
import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { Modal } from '../Modal'
import { X } from 'lucide-react'
import MDEditor from '@uiw/react-md-editor'
import rehypeSanitize from 'rehype-sanitize'
import {
  opportunityApi,
  programImageUrl,
  type Opportunity,
  type OpportunityKind,
} from '../../api/opportunities'
import { apiRuntime } from '../../api/runtime'
import type { Company } from '../../types/models'
import { localDate, localDayEnd } from '../../utils/date'
import { uploadFile } from '../../utils/files'
import { shorteningError } from '../../utils/publicationLength'

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
  onDraftChange,
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
  onDraftChange?: (item: Opportunity) => void
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
  const initialDeadline = initial.application_deadline
    ? localDate(new Date(initial.application_deadline))
    : ''
  const [selectedDeadline, setSelectedDeadline] = useState(initialDeadline)
  const today = localDate()
  const deadlineError =
    selectedDeadline && selectedDeadline < today && selectedDeadline !== initialDeadline
      ? 'Срок подачи заявок не может быть в прошлом.'
      : ''
  const titleError = shorteningError('название', editor.title || '', 200, 'utf8')
  const summaryError = shorteningError('краткое описание', editor.summary || '', 1000, 'utf8')
  const contentError = shorteningError('программу', editor.content_markdown || '', 50000, 'utf8')
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
    (initial.program_id ? 'Редактирование ' : 'Размещение ') +
    (editor.kind === 'practice' ? 'практики' : 'стажировки')
  const programId = editor.program_id
  const previewImage = useMemo(
    () => (props: { src?: string; alt?: string }) => (
      <ProgramMarkdownImage {...props} programId={programId} authenticated />
    ),
    [programId],
  )
  const payload = {
    kind: editor.kind,
    company_id: companyId,
    title: editor.title,
    summary: editor.summary,
    content_markdown: editor.content_markdown,
    capacity: editor.capacity,
    application_deadline:
      selectedDeadline === initialDeadline
        ? (initial.application_deadline ?? null)
        : selectedDeadline
          ? localDayEnd(selectedDeadline)
          : null,
    file_ids: editor.file_ids ?? [],
  }

  const uploadImage = async (file: File) => {
    if (apiRuntime.mode !== 'live') {
      const uploaded = await uploadFile(file)
      setEditor((current) => ({
        ...current,
        content_markdown:
          (current.content_markdown || '') + markdownImageLink(file.name, uploaded.url),
      }))
      return
    }
    if (busy || companyUnavailable || !companyId) throw new Error('Сначала укажите компанию.')
    if (file.type === 'image/gif') throw new Error('Выберите PNG, JPG или WebP.')
    if (!editor.title?.trim() || !editor.summary?.trim() || !editor.capacity || hasFieldErrors)
      throw new Error(
        'Перед загрузкой фото проверьте название, краткое описание, количество мест и срок подачи заявок.',
      )
    if (payload.file_ids.length >= 30) throw new Error('К программе можно прикрепить до 30 файлов.')

    setError('')
    setBusy(true)
    onBusyChange?.(true)
    try {
      let id = programId
      if (!id) {
        const draft = await opportunityApi.save(undefined, {
          ...payload,
          content_markdown: payload.content_markdown?.trim() || editor.summary,
        })
        id = draft.program_id
        setEditor((current) => ({
          ...current,
          program_id: id,
          company_id: companyId,
          status: 'draft',
        }))
        onDraftChange?.(draft)
      }
      const uploaded = await uploadFile(file)
      if (!uploaded.file_id) throw new Error('Сервер не вернул ID фото.')
      const markdown =
        (payload.content_markdown || '') +
        markdownImageLink(file.name, programImageUrl(id, uploaded.file_id))
      const fileIds = [...new Set([...payload.file_ids, uploaded.file_id])]
      try {
        const saved = await opportunityApi.save(id, {
          ...payload,
          content_markdown: markdown,
          file_ids: fileIds,
        })
        const updated = { ...saved, file_ids: saved.file_ids ?? fileIds }
        setEditor(updated)
        onDraftChange?.(updated)
      } catch (cause) {
        setEditor((current) => ({ ...current, content_markdown: markdown, file_ids: fileIds }))
        throw cause
      }
    } finally {
      setBusy(false)
      onBusyChange?.(false)
    }
  }

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
              <input
                className="input"
                required
                name="title"
                aria-errormessage={titleError ? 'opportunity-title-limit' : undefined}
                aria-invalid={titleError ? true : undefined}
                value={editor.title || ''}
                onChange={(event) => setEditor({ ...editor, title: event.target.value })}
              />
              {titleError && (
                <span id="opportunity-title-limit" className="publication-field-error" role="alert">
                  {titleError}
                </span>
              )}
            </label>
            <label>
              Краткое описание
              <textarea
                className="textarea"
                required
                name="summary"
                rows={2}
                aria-errormessage={summaryError ? 'opportunity-summary-limit' : undefined}
                aria-invalid={summaryError ? true : undefined}
                value={editor.summary || ''}
                onChange={(event) => setEditor({ ...editor, summary: event.target.value })}
              />
              {summaryError && (
                <span
                  id="opportunity-summary-limit"
                  className="publication-field-error"
                  role="alert"
                >
                  {summaryError}
                </span>
              )}
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
                  placeholder="От 1 до 10 000"
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
                    initialDeadline === selectedDeadline && selectedDeadline < today
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
              <p id="opportunity-program-label">Программа и условия участия</p>
              {apiRuntime.mode === 'live' && (
                <p className="form-hint">При добавлении фото программа сохраняется.</p>
              )}
              <MarkdownImageUpload onUpload={uploadImage} />
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
                  'aria-errormessage': contentError ? 'opportunity-content-limit' : undefined,
                  onInput: (event) => event.currentTarget.setCustomValidity(''),
                }}
                previewOptions={{
                  rehypePlugins: [[rehypeSanitize, markdownSchema]],
                  components: { img: previewImage },
                }}
              />
              {contentError && (
                <p id="opportunity-content-limit" className="publication-field-error" role="alert">
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
