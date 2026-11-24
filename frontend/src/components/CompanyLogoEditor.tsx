import { apiClient } from '../api/client'
import type { Company } from '../types/models'
import { AvatarPhotoPicker } from './AvatarPhotoPicker'
import { CompanyLogo } from './CompanyLogo'

export function CompanyLogoEditor({
  company,
  onSaved,
}: {
  company: Company
  onSaved: (company: Company) => void
}) {
  return (
    <AvatarPhotoPicker
      label={company.logoFileId ? 'Заменить логотип' : 'Загрузить логотип'}
      cropOptions={{
        title: 'Обрезать логотип компании',
        instructions:
          'Переместите изображение и настройте масштаб. Сохранится область внутри рамки.',
        notice:
          company.status === 'approved'
            ? 'После сохранения компания снова пройдёт модерацию.'
            : undefined,
        saveLabel: 'Сохранить логотип',
        initialZoom: 1,
      }}
      onSave={async (file) => {
        onSaved(await apiClient.updateCompanyLogo(company, file))
      }}
    >
      <CompanyLogo company={company} className="company-hero__logo" />
    </AvatarPhotoPicker>
  )
}
