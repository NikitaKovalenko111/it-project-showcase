import { apiRuntime } from '../api/runtime'
import { axiosInstance } from '../api/http'
import { fromCompany } from '../api/backend'
import { Link } from 'react-router-dom'
import MDEditor from '@uiw/react-md-editor'
import rehypeSanitize from 'rehype-sanitize'
import React, { useEffect, useState } from 'react'
import { Company } from '../types/models'
import { communityApi } from '../api/community'
import { useAppDispatch } from '../store'
import { fetchCompanyByIdSuccess } from '../store/actions'

export const CompanyProgram: React.FC<{
  company: Company
  editable: boolean
  practice?: boolean
}> = ({ company, editable, practice = false }) => {
  const dispatch = useAppDispatch()
  const [text, setText] = useState(
      (practice ? company.practiceProgram : company.internshipProgram) || '',
    ),
    [editing, setEditing] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    setText((practice ? company.practiceProgram : company.internshipProgram) || '')
    setEditing(false)
  }, [company.id, company.internshipProgram, company.practiceProgram, practice])
  return (
    <section className="feature-panel">
      <h3>{practice ? 'Практики' : 'Стажировки'}</h3>
      {editing ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setError('')
            try {
              const updated =
                apiRuntime.mode === 'live'
                  ? fromCompany(
                      (
                        await axiosInstance.patch(
                          `/companies/${company.id}/programs`,
                          practice ? { practice_program: text } : { internship_program: text },
                        )
                      ).data,
                    )
                  : await communityApi.updateCompanyContent(company.id, {
                      description: company.description,
                      ...(practice ? { practiceProgram: text } : { internshipProgram: text }),
                    })
              dispatch(fetchCompanyByIdSuccess(updated))
              setEditing(false)
            } catch (e) {
              setError((e as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          <div data-color-mode="light">
            <MDEditor
              value={text}
              onChange={(value) => setText((value || '').slice(0, 15000))}
              height={350}
              textareaProps={{ 'aria-label': 'Условия, отбор, сроки и контакты', maxLength: 15000 }}
              previewOptions={{ rehypePlugins: [rehypeSanitize] }}
            />
          </div>
          <div className="action-row">
            <button className="btn btn-primary" disabled={busy}>
              Сохранить программу
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
              Отмена
            </button>
          </div>
        </form>
      ) : (
        <>
          <MDEditor.Markdown
            rehypePlugins={[rehypeSanitize]}
            source={
              (practice ? company.practiceProgram : company.internshipProgram) ||
              'Компания пока не опубликовала программу.'
            }
          />
          <div className="action-row">
            {editable && (
              <button className="btn btn-secondary" onClick={() => setEditing(true)}>
                Редактировать описание
              </button>
            )}
            {apiRuntime.mode === 'live' && (
              <Link
                className="btn btn-secondary"
                to={`/internships?company=${company.id}&kind=${practice ? 'practice' : 'internship'}&scope=all`}
              >
                {practice ? 'Открытые практики' : 'Открытые стажировки'}
              </Link>
            )}
          </div>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
