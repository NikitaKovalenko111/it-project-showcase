import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const read = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'))
const write = (name, data) => writeFileSync(new URL(name, import.meta.url), JSON.stringify(data, null, 2) + '\n')
// Each company gets a different photograph. Reuse the repository's reviewed assets.
const selections = [
  'demo-industrial', 'greenhouse', 'industrial', 'bicycle', 'energy', 'demo-data-quality',
  'laboratory', 'workspace', 'server', 'library', 'demo-meter', 'robot',
  'demo-network-analysis', 'coding', 'warehouse', 'demo-gis', 'demo-campus-map', 'vr',
  'gaming', 'demo-documents', 'demo-support', 'mobile', 'math', 'demo-olympiad',
  'office-open', 'demo-integration', 'demo-telecom', 'demo-editorial', 'demo-coding',
  'demo-routing', 'solar', 'analytics', 'museum', 'demo-task-tracker', 'office-meeting', 'city',
]
const companies = read('data/companies.json')
const assignments = read('sources/cover-assignments.json')
for (const [index, company] of companies.entries()) {
  const selection = selections[index]
  const sourcePath = `assets/photos/${selection}.jpg`
  if (selection.startsWith('demo-')) {
    copyFileSync(new URL(`../backend/demo/media/${selection.slice(5)}.jpg`, import.meta.url), new URL(sourcePath, import.meta.url))
  }
  copyFileSync(new URL(sourcePath, import.meta.url), new URL(company.coverImage, import.meta.url))
  const assignment = assignments.find((item) => item.entityType === 'company' && item.entityId === company.id)
  if (assignment) assignment.sourcePath = sourcePath
}
write('sources/cover-assignments.json', assignments)

const hash = (path) => createHash('sha256').update(readFileSync(new URL(path, import.meta.url))).digest('hex')
const students = read('data/students.json')
for (const [name, paths] of [
  ['student portraits', students.map((student) => student.avatar)],
  ['company covers', companies.map((company) => company.coverImage)],
]) {
  if (new Set(paths.map(hash)).size !== paths.length) throw new Error(`Duplicate ${name}`)
}
for (const company of companies) readFileSync(new URL(company.logo, import.meta.url))
write('review/media-audit.json', {
  date: '2026-11-24', studentPortraits: students.length, uniqueStudentPortraits: new Set(students.map((s) => hash(s.avatar))).size,
  companyLogos: companies.length, companyCovers: companies.length, uniqueCompanyCovers: new Set(companies.map((c) => hash(c.coverImage))).size,
  replacedPortraits: [36, 40, 46, 48, 49, 54], criteria: 'Visible clothing; no ethnicity or nationality classification.',
})
console.log('Media checked: 60 unique portraits; 36 logos and unique company covers.')
