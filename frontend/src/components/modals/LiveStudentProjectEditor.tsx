import { isOptionalWebUrl } from '../../utils/validation'
import { LocalizedFileInput } from '../LocalizedFileInput'
import { useEffect, useState, type FormEvent } from 'react'
import { axiosInstance } from '../../api/http'
import { fromProject } from '../../api/backend'
import {
  getProjectCatalog,
  projectCategories,
  projectCategoryCode,
  type ProjectCatalog,
} from '../../api/studentProjectCatalog'
import type { StudentProject, StudentProjectCategory } from '../../types/models'
import { uploadFile } from '../../utils/files'
import { Modal } from '../Modal'

export function LiveStudentProjectEditor({
  project,
  onSaved,
  onClose,
}: {
  project?: StudentProject
  onSaved: (project: StudentProject) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(project?.server)
  const [id, setId] = useState(project?.id)
  const [catalog, setCatalog] = useState<ProjectCatalog>()
  const [form, setForm] = useState({
    title: project?.title || '',
    category: project?.category || 'pet-проект',
    shortDescription: project?.shortDescription || '',
    fullDescription: project?.fullDescription || '',
    problemSolved: project?.problemSolved || '',
    githubUrl: project?.githubUrl || '',
    productUrl: project?.productUrl || '',
    visibility: project?.visibility || 'private',
    directionIds: project?.server?.directionIds || [],
    technologyIds: project?.server?.technologyIds || [],
  })
  const [cover, setCover] = useState<File>()
  const [screenshots, setScreenshots] = useState<File[]>([])
  const [removeCover, setRemoveCover] = useState(false)
  const [removeScreenshots, setRemoveScreenshots] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getProjectCatalog()
      .then((value) => {
        if (active) setCatalog(value)
      })
      .catch(() => {
        if (active)
          setError('Не удалось загрузить направления и технологии. Откройте форму ещё раз.')
      })
    return () => {
      active = false
    }
  }, [])

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }))

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!catalog || saving) return
    const submit = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'publish'
    const assets = (draft?.assets || []).filter(
      (asset) => !removeScreenshots || asset.kind !== 'screenshot',
    )
    setError('')
    setSaving(true)
    try {
      if (!form.title.trim() || !form.shortDescription.trim()) {
        throw new Error('Заполните название и краткое описание.')
      }
      if (![form.githubUrl, form.productUrl].every(isOptionalWebUrl)) {
        throw new Error('Укажите ссылки с http:// или https://.')
      }
      if (form.directionIds.length > 20 || form.technologyIds.length > 50) {
        throw new Error('Можно выбрать до 20 направлений и до 50 технологий.')
      }
      if (assets.length + screenshots.length > 50)
        throw new Error('В проекте может быть до 50 вложений.')
      if (
        [...screenshots, ...(cover ? [cover] : [])].some((file) => !file.type.startsWith('image/'))
      ) {
        throw new Error('Выберите изображения.')
      }
      const coverId = cover
        ? (await uploadFile(cover)).file_id
        : removeCover
          ? undefined
          : draft?.coverFileId
      const uploaded = await Promise.all(screenshots.map(uploadFile))
      const ordinal = Math.max(0, ...assets.map((asset) => asset.ordinal))
      const payload = {
        title: form.title.trim(),
        category: projectCategoryCode(form.category),
        short_description: form.shortDescription.trim(),
        full_description: form.fullDescription.trim() || form.shortDescription.trim(),
        problem_solved: form.problemSolved.trim(),
        github_url: form.githubUrl.trim(),
        product_url: form.productUrl.trim(),
        visibility: form.visibility,
        direction_ids: form.directionIds,
        technology_ids: form.technologyIds,
        tags: draft?.tags || [],
        members: (draft?.members || []).map(({ student_id, role_name }) => ({
          student_id,
          role_name,
        })),
        cover_file_id: coverId || '',
        assets: [
          ...assets,
          ...uploaded.map((file, index) => ({
            file_id: file.file_id,
            kind: 'screenshot',
            ordinal: ordinal + index + 1,
          })),
        ],
      }
      const { data } = id
        ? await axiosInstance.put(`/student-projects/${id}`, payload)
        : await axiosInstance.post('/student-projects', payload)
      const saved = fromProject(data, catalog)
      setId(saved.id)
      setDraft(saved.server)
      setCover(undefined)
      setScreenshots([])
      setRemoveCover(false)
      setRemoveScreenshots(false)
      if (submit && form.visibility === 'public') {
        const result = await axiosInstance.post(`/student-projects/${saved.id}/submit-moderation`)
        onSaved(fromProject(result.data, catalog))
      } else {
        onSaved(saved)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={project ? 'Редактировать студенческий проект' : 'Новый студенческий проект'}
      onClose={onClose}
      busy={saving}
    >
      <form onSubmit={save}>
        <div className="modal-dialog__body">
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {!catalog && !error && <p role="status">Загружаем направления и технологии…</p>}
          <fieldset aria-label="Данные проекта" disabled={saving || !catalog}>
            <label>
              Видимость
              <select
                className="select"
                value={form.visibility}
                onChange={(e) => update('visibility', e.target.value as 'private' | 'public')}
              >
                <option value="private">Только я</option>
                <option value="public">В открытой витрине после модерации</option>
              </select>
            </label>
            <label>
              Название
              <input
                className="input"
                required
                maxLength={200}
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
              />
            </label>
            <label>
              Категория
              <select
                className="select"
                value={form.category}
                onChange={(e) => update('category', e.target.value as StudentProjectCategory)}
              >
                {projectCategories.map(([code, name]) => (
                  <option value={name} key={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Краткое описание
              <textarea
                className="textarea"
                required
                maxLength={1000}
                value={form.shortDescription}
                onChange={(e) => update('shortDescription', e.target.value)}
              />
            </label>
            <label>
              Подробное описание
              <textarea
                className="textarea"
                maxLength={30000}
                value={form.fullDescription}
                onChange={(e) => update('fullDescription', e.target.value)}
              />
            </label>
            <label>
              Решаемая проблема
              <textarea
                className="textarea"
                value={form.problemSolved}
                onChange={(e) => update('problemSolved', e.target.value)}
              />
            </label>
            <label>
              Направления
              <select
                className="select"
                multiple
                size={5}
                value={form.directionIds}
                onChange={(e) =>
                  update(
                    'directionIds',
                    Array.from(e.target.selectedOptions, (option) => option.value),
                  )
                }
              >
                {catalog?.directions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Технологии
              <select
                className="select"
                multiple
                size={5}
                value={form.technologyIds}
                onChange={(e) =>
                  update(
                    'technologyIds',
                    Array.from(e.target.selectedOptions, (option) => option.value),
                  )
                }
              >
                {catalog?.technologies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Репозиторий
              <input
                className="input"
                type="url"
                value={form.githubUrl}
                onChange={(e) => update('githubUrl', e.target.value)}
              />
            </label>
            <label>
              Ссылка на демо
              <input
                className="input"
                type="url"
                value={form.productUrl}
                onChange={(e) => update('productUrl', e.target.value)}
              />
            </label>
            <label>
              Обложка
              <LocalizedFileInput
                className="input"
                accept="image/*"
                onChange={(e) => setCover(e.target.files?.[0])}
              />
            </label>
            {draft?.coverFileId && !cover && (
              <label>
                <input
                  type="checkbox"
                  checked={removeCover}
                  onChange={(e) => setRemoveCover(e.target.checked)}
                />{' '}
                Убрать сохранённую обложку
              </label>
            )}
            <label>
              Скриншоты
              <LocalizedFileInput
                className="input"
                accept="image/*"
                multiple
                onChange={(e) => setScreenshots(Array.from(e.target.files || []))}
              />
            </label>
            {draft?.assets.some((asset) => asset.kind === 'screenshot') && (
              <label>
                <input
                  type="checkbox"
                  checked={removeScreenshots}
                  onChange={(e) => setRemoveScreenshots(e.target.checked)}
                />{' '}
                Убрать ранее сохранённые скриншоты
              </label>
            )}
          </fieldset>
        </div>
        <div className="modal-dialog__footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <button className="btn btn-secondary" disabled={!catalog || saving}>
            Сохранить черновик
          </button>
          {form.visibility === 'public' && (
            <button className="btn btn-primary" value="publish" disabled={!catalog || saving}>
              Отправить на модерацию
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}
