import { useState } from 'react'
import { axiosInstance } from '../api/http'
import { fromCompany } from '../api/backend'
import { apiRuntime } from '../api/runtime'
import { communityApi } from '../api/community'
import type { Company } from '../types/models'

const fields = [
  { key: 'inn', name: 'ИНН', maxLength: 12, pattern: '[0-9]{10}([0-9]{2})?' },
  { key: 'kpp', name: 'КПП', maxLength: 9, pattern: '[0-9]{9}' },
  { key: 'ogrn', name: 'ОГРН / ОГРНИП', maxLength: 15, pattern: '[0-9]{13}([0-9]{2})?' },
  { key: 'legalAddress', name: 'Юридический адрес', maxLength: 500 },
] as const

export function CompanyLegalDetails({
  company,
  editable,
  onSaved,
}: {
  company: Company
  editable: boolean
  onSaved: (company: Company) => void
}) {
  const [draft, setDraft] = useState<Pick<Company, (typeof fields)[number]['key']>>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const values = fields.filter((field) => !!company[field.key])

  return (
    <section className="card feature-panel company-legal">
      <div className="feature-toolbar">
        <h2>Юридические сведения</h2>
        {editable && !draft && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setError('')
              setDraft({
                inn: company.inn,
                kpp: company.kpp,
                ogrn: company.ogrn,
                legalAddress: company.legalAddress,
              })
            }}
          >
            Редактировать реквизиты
          </button>
        )}
      </div>
      {draft ? (
        <form
          noValidate
          onSubmit={async (event) => {
            event.preventDefault()
            if (saving) return
            const invalid = fields.find((field) => {
              const value = draft[field.key]?.trim()
              return (
                value && 'pattern' in field && !new RegExp(`^(?:${field.pattern})$`).test(value)
              )
            })
            if (invalid) {
              setError(
                `${invalid.name} — ${
                  {
                    inn: 'укажите 10 или 12 цифр.',
                    kpp: 'укажите 9 цифр.',
                    ogrn: 'укажите 13 или 15 цифр.',
                    legalAddress: '',
                  }[invalid.key]
                }`,
              )
              return
            }
            setSaving(true)
            setError('')
            try {
              const updated =
                apiRuntime.mode === 'live'
                  ? fromCompany(
                      (
                        await axiosInstance.patch('/companies/' + company.id + '/legal', {
                          inn: draft.inn?.trim() || '',
                          kpp: draft.kpp?.trim() || '',
                          ogrn: draft.ogrn?.trim() || '',
                          legal_address: draft.legalAddress?.trim() || '',
                        })
                      ).data,
                    )
                  : await communityApi.updateCompanyContent(company.id, {
                      description: company.description,
                      ...draft,
                    })
              onSaved(updated)
              setDraft(undefined)
            } catch (cause) {
              setError((cause as Error).message)
            } finally {
              setSaving(false)
            }
          }}
        >
          <div className="company-legal-grid">
            {fields.map((field) => (
              <label key={field.key}>
                {field.name}
                <input
                  className="input"
                  value={draft[field.key] || ''}
                  maxLength={field.maxLength}
                  inputMode={'pattern' in field ? 'numeric' : undefined}
                  disabled={saving}
                  onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                />
              </label>
            ))}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="action-row">
            <button className="btn btn-primary btn-sm" disabled={saving}>
              Сохранить реквизиты
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={saving}
              onClick={() => setDraft(undefined)}
            >
              Отмена
            </button>
          </div>
        </form>
      ) : values.length ? (
        <dl className="company-legal-grid">
          {values.map((field) => (
            <div key={field.key}>
              <dt>{field.name}</dt>
              <dd>{company[field.key]}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>Компания пока не указала реквизиты.</p>
      )}
    </section>
  )
}
