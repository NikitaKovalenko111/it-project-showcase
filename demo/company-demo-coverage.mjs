const demoLabel = 'Учебный сценарий демонстрационной витрины.'

export function companyDemoCoverage(companies, cases, programs) {
  const newCases = []
  const newPrograms = []
  for (const [index, company] of companies.entries()) {
    const publicCases = cases.filter((item) => item.companyId === company.id && !item.isConfidential)
    const example = publicCases.find((item) => item.isModerated && item.kind === 'case') ?? publicCases[0]
    const field = company.industry.toLowerCase()
    const scenario = example?.shortDescription ?? `Подготовить прототип для учебной задачи в области «${field}».`
    const direction = example?.direction ?? company.directions?.[0] ?? 'Бизнес-анализ'
    const skills = [...new Set([...(example?.recommendedTech ?? []), ...(company.techStack ?? [])])].slice(0, 3)
    const brief = { direction, recommendedTech: skills, complexity: 'Средний', workFormat: 'смешанный' }
    const addCase = (key, title, summary, status, kind = 'case', rewardType = 'educational') => {
      const finished = status === 'completed'
      const due = finished ? '2026-11-14' : '2026-12-18'
      newCases.push({
        ...brief, id: `company-demo:${company.id}:${key}`, companyId: company.id, title, status, kind, rewardType,
        shortDescription: summary,
        fullDescription: `${demoLabel}\n\n## Сценарий\n\n${summary}\n\n## Защита\n\nПоказать основной сценарий, сравнить ожидаемый и полученный результат, перечислить ограничения.`,
        resultRequirements: 'Прототип, проверочный пример и короткая инструкция для наставника.',
        evaluationOrder: 'Работоспособность, качество проверок и ясность защиты.',
        evaluationCriteria: [{ label: 'Основной сценарий', maxScore: 60 }, { label: 'Проверка результата', maxScore: 40 }],
        participationFormat: 'individual', teamSize: { min: 1, max: 1 },
        duration: '3 недели', publishedAt: finished ? '2026-10-22' : '2026-11-18',
        applicationDeadline: finished ? '2026-10-29' : '2026-12-05', deadlineDate: due,
      })
    }
    addCase('mvp', `Проверка прототипа · ${company.shortName}`, scenario, 'in_progress', 'case', 'monetary')
    if (!publicCases.some((item) => ['open', 'selection', 'published'].includes(item.status))) {
      addCase('open', `Набор в проектную мастерскую · ${company.shortName}`, `Подготовить пример пользовательского сценария. ${scenario}`, 'open')
    }
    if (!publicCases.some((item) => item.status === 'completed')) {
      addCase('completed', `Итоговая защита · ${company.shortName}`, `Студент собрал учебный прототип, провёл контрольный прогон и оформил результаты. Исходная задача: ${scenario}`, 'completed', 'case', 'contest')
    }
    if (['025', '026', '027', '028', '030'].includes(company.id.slice(-3))) {
      addCase('olympiad', `Олимпиада по анализу требований · ${company.shortName}`, `Разобрать учебный сценарий и предложить проверяемые критерии. Тема: ${scenario}`, 'open', 'olympiad', 'contest')
      if (!publicCases.some((item) => item.kind === 'hackathon' && ['open', 'published', 'in_progress'].includes(item.status))) {
        addCase('hackathon', `Хакатон прототипов · ${company.shortName}`, scenario, 'open', 'hackathon', 'contest')
      }
    }
    for (const kind of ['practice', 'internship']) {
      if (programs.some((item) => item.company_id === company.id && item.kind === kind && item.status === 'published')) continue
      const practice = kind === 'practice'
      const title = `${practice ? 'Проектная практика' : 'Стажировка с наставником'} · ${company.shortName}`
      newPrograms.push({
        program_id: `company-demo-program:${company.id}:${kind}`, company_id: company.id, kind, title,
        summary: scenario, skills, status: 'published', capacity: 3 + index % 4, application_deadline: '2026-12-21',
        content_markdown: [
          'Учебная программа демонстрационной витрины.',
          `## Задача\n\n${scenario}`,
          practice ? '## Формат\n\n6 недель по 12 часов. Еженедельный разбор с наставником, отчёт и защита.' : '## Формат\n\n8 недель по 16 часов. Сначала разбор требований, затем прототип и две проверки с наставником.',
          '## Отклик\n\nПриложите резюме и расскажите, какую часть учебного проекта сделали самостоятельно.',
        ].join('\n\n'),
      })
    }
  }
  return { newCases, newPrograms }
}
