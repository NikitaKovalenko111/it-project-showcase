import { companyBriefs, portfolioBriefs, specializations, studentNames } from './catalog'

// All contacts and legal identifiers belong to fictional teaching records.
export function companyDetails(index: number) {
  const innBase = '0000' + String(index + 1).padStart(5, '0')
  const weights = [2, 4, 10, 3, 5, 9, 4, 6, 8]
  const check =
    ([...innBase].reduce((sum, digit, i) => sum + Number(digit) * weights[i], 0) % 11) % 10
  const ogrnBase = '00000' + String(index + 1).padStart(7, '0')
  return {
    inn: innBase + check,
    kpp: '000001001',
    ogrn: ogrnBase + (Number(BigInt(ogrnBase) % 11n) % 10),
    legalAddress:
      '000000, Учебный город, улица Проектная, дом ' + (index + 1) + ', офис ' + (101 + index),
    phone: '+7 (000) 000-' + String(10 + index).padStart(2, '0') + '-00',
    documents: [
      { name: 'Карточка организации.pdf', url: '/demo/documents/company-' + (index + 1) + '.pdf' },
      {
        name: 'Порядок прохождения практики.pdf',
        url: '/demo/documents/practice-' + (index + 1) + '.pdf',
      },
    ],
  }
}

export function studentDetails(index: number) {
  const profile = specializations[index % specializations.length]
  const number = index + 1
  return {
    phone: '+7 (000) 100-' + String(number).padStart(2, '0') + '-00',
    githubUrl: 'https://example.org/#student-' + number + '-code',
    ...(index % 3 === 0
      ? { gitlabUrl: 'https://example.org/#student-' + number + '-laboratory' }
      : {}),
    portfolioUrl: 'https://example.org/#student-' + number + '-portfolio',
    links: [
      { kind: 'Портфолио', url: 'https://example.org/#student-' + number + '-portfolio' },
      ...(index % 2 === 0
        ? [{ kind: 'Блог', url: 'https://example.org/#student-' + number + '-notes' }]
        : []),
    ],
    resume: {
      name: 'Резюме - ' + studentNames[index] + '.pdf',
      url: '/demo/documents/resume-' + number + '.pdf',
      public: index % 4 !== 3,
    },
    files:
      index % 3 === 2
        ? []
        : [
            {
              name: 'Сертификат проектного семинара.svg',
              url: '/demo/documents/certificate-' + number + '.svg',
            },
          ],
    interests: [
      profile.direction,
      companyBriefs[index % companyBriefs.length].industry,
      [
        'Доступность интерфейсов',
        'Качество данных',
        'Инженерные исследования',
        'Командная разработка',
      ][index % 4],
    ],
  }
}

export const documentContent = {
  students: studentNames.map((name, index) => ({
    name,
    ...specializations[index % specializations.length],
    project: portfolioBriefs[index % portfolioBriefs.length],
    contact: studentDetails(index),
  })),
  companies: companyBriefs.map((company, index) => ({ ...company, ...companyDetails(index) })),
  projects: portfolioBriefs,
}
