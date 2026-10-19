import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import { fetchCasesRequest, fetchFavoritesRequest, toggleFavoriteRequest } from '../store/actions'
import { Bookmark, Calendar, FolderGit2, Trash2, Users } from 'lucide-react'

export const FavoritesPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { casesList, favorites, loading } = useAppSelector((state) => state.cases)

  useEffect(() => {
    dispatch(fetchCasesRequest())
    dispatch(fetchFavoritesRequest())
  }, [dispatch])

  const favoriteCases = casesList.filter((c) => favorites.includes(c.id))

  const handleRemoveFavorite = (caseId: string) => {
    dispatch(toggleFavoriteRequest(caseId))
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header__content">
          <h1>Избранные кейсы и отслеживание сроков (п. 5.19 ТЗ)</h1>
          <p>
            Сохраненные проекты. Отслеживайте приближение контрольных сроков подачи заявок и этапов выполнения.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>Загрузка избранного...</div>
      ) : favoriteCases.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Bookmark size={48} color="#94a3b8" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ margin: '0 0 8px', color: '#1e293b' }}>У вас пока нет сохранённых кейсов</h3>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px' }}>
            Нажимайте иконку закладки на карточке любого проекта в витрине, чтобы добавить его сюда.
          </p>
          <Link to="/cases" className="btn btn-primary btn-sm" style={{ margin: '0 auto' }}>
            Перейти к витрине кейсов
          </Link>
        </div>
      ) : (
        <div className="case-grid">
          {favoriteCases.map((item) => (
            <div key={item.id} className="card card-hover case-card">
              <button
                className="case-card__fav-btn favorited"
                onClick={() => handleRemoveFavorite(item.id)}
                title="Удалить из избранного"
              >
                <Trash2 size={15} color="#e11d48" />
              </button>

              <div className="card__body">
                <div className="case-card__company">
                  <img src={item.companyLogo} alt={item.companyName} />
                  <span className="company-title">{item.companyName}</span>
                </div>

                <Link to={`/cases/${item.id}`}>
                  <h3 className="case-card__title">{item.title}</h3>
                </Link>

                <p className="case-card__desc">{item.shortDescription}</p>

                <div className="case-card__tags">
                  <span className="badge badge-direction">{item.direction}</span>
                  <span className="badge badge-complexity-medium">{item.complexity}</span>
                </div>

                <div className="case-card__meta-grid">
                  <div className="meta-item">
                    <Calendar size={13} color="#b91c1c" />
                    <span>
                      Дедлайн: <strong style={{ color: '#b91c1c' }}>{new Date(item.deadlineDate).toLocaleDateString('ru-RU')}</strong>
                    </span>
                  </div>
                  <div className="meta-item">
                    <Users size={13} />
                    <span>
                      Команда: <strong>{item.teamSize.min}-{item.teamSize.max} чел.</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="card__footer">
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Заявок: <strong>{item.applicationsCount}</strong>
                </span>
                <Link to={`/cases/${item.id}`} className="btn btn-primary btn-sm">
                  Перейти к кейсу →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
