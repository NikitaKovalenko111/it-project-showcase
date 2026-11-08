import React from 'react'
import { CaseProject } from '../types/models'
export const PublicationContext: React.FC<{ project: CaseProject }> = ({ project }) => {
  const d = project.publicationDetails
  const internship = project.kind === 'internship',
    olympiad = project.kind === 'olympiad'
  if (!d) return null
  return (
    <section className="card publication-context">
      <h3>
        {internship
          ? 'Программа стажировки'
          : olympiad
            ? 'Туры и регламент олимпиады'
            : 'Программа хакатона'}
      </h3>
      <div className="publication-facts">
        <span>
          Начало: <strong>{d.startDate}</strong>
        </span>
        <span>
          Место: <strong>{d.venue}</strong>
        </span>
        {internship && (
          <>
            <span>
              Позиция: <strong>{d.position}</strong>
            </span>
            <span>
              Занятость: <strong>{d.workload}</strong>
            </span>
          </>
        )}
      </div>
      <p style={{ whiteSpace: 'pre-wrap' }}>{d.schedule}</p>
      {internship && <p>Отбор: {d.selection}</p>}
      <p>
        {internship
          ? 'В этапах фиксируются задачи стажёра и обратная связь наставника. Итог — отчёт и выполненные материалы.'
          : olympiad
            ? 'Контрольные точки соответствуют турам. Участник прикладывает решения заданий; итог оценивается по регламенту.'
            : 'Контрольные точки соответствуют разработке и защите прототипа. Команда сдаёт решение и презентацию.'}
      </p>
    </section>
  )
}
