import { useState } from 'react'
import { companyMembershipApi } from '../api/client'
import type { CompanyDraft } from '../api/companyMembership'
import type { Company } from '../types/models'
import { Modal } from './Modal'

const fields = [
  { key: 'full_name', label: 'Полное название', limit: 300, required: true },
  { key: 'inn', label: 'ИНН', limit: 12, required: true },
  { key: 'short_name', label: 'Краткое название', limit: 100 },
  { key: 'industry', label: 'Отрасль', limit: 150 },
  { key: 'website', label: 'Сайт', limit: 2048 },
  { key: 'position', label: 'Ваша должность', limit: 150 },
  { key: 'description', label: 'Описание', limit: 5000, multiline: true },
  { key: 'activities', label: 'Направления деятельности', limit: 3000, multiline: true },
  { key: 'contacts', label: 'Контакты компании', limit: 1000, multiline: true },
] as const

export function CompanyEditor({
  company,
  onSaved,
  onClose,
}: {
  company?: Company
  onSaved: (company: Company) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<CompanyDraft>({
    full_name: company?.name || '',
    inn: company?.inn || '',
    short_name: company?.shortName || '',
    industry: company?.industry || '',
    description: company?.description || '',
    activities: company?.activities || '',
    website: company?.website || '',
    contacts: company?.email || '',
    position: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  return (
    <Modal
      title={company ? 'Редактировать компанию' : 'Создать компанию'}
      busy={busy}
      onClose={onClose}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (busy) return
          if (!draft.full_name.trim()) return setError('Укажите полное название компании.')
          setBusy(true)
          setError('')
          try {
            onSaved(await companyMembershipApi.save(draft, company?.id))
          } catch (cause) {
            const failure = cause as Error & { code?: string }
            setError(
              failure.code === 'validation_failed'
                ? 'Проверьте название, контрольные цифры ИНН и адрес сайта.'
                : failure.message,
            )
          } finally {
            setBusy(false)
          }
        }}
      >
        <div className="modal-dialog__body">
          {company?.status === 'approved' && (
            <p>После сохранения компания снова пройдёт модерацию.</p>
          )}
          <fieldset className="responsive-grid" disabled={busy}>
            {fields
              .filter((field) => !company || field.key !== 'position')
              .map((field) => (
                <label className="form-group" key={field.key}>
                  {field.label}
                  {'required' in field && ' *'}
                  {'multiline' in field ? (
                    <textarea
                      className="textarea"
                      rows={3}
                      maxLength={field.limit}
                      value={draft[field.key]}
                      onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                    />
                  ) : (
                    <input
                      className="input"
                      maxLength={field.limit}
                      value={draft[field.key]}
                      type={field.key === 'website' ? 'url' : 'text'}
                      required={'required' in field}
                      inputMode={field.key === 'inn' ? 'numeric' : undefined}
                      pattern={field.key === 'inn' ? '[0-9]{10}|[0-9]{12}' : undefined}
                      title={field.key === 'inn' ? '10 или 12 цифр' : undefined}
                      onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                    />
                  )}
                </label>
              ))}
          </fieldset>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="modal-dialog__footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Сохраняем…' : company ? 'Сохранить' : 'Создать черновик'}
          </button>
        </footer>
      </form>
    </Modal>
  )
}
