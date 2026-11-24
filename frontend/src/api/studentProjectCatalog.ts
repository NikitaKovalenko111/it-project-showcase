import { axiosInstance } from './http'
import type { StudentProjectCategory } from '../types/models'

type CatalogItem = { id: string; name: string }
export type ProjectCatalog = { directions: CatalogItem[]; technologies: CatalogItem[] }

export const projectCategories = [
  ['pet_project', 'pet-проект'],
  ['coursework', 'курсовой'],
  ['startup', 'стартап'],
  ['research', 'НИР'],
  ['hackathon', 'хакатон'],
  ['other', 'учебный'],
] as const

export function projectCategoryCode(category: StudentProjectCategory) {
  return projectCategories.find(([, name]) => name === category)?.[0] || 'other'
}

let catalogRequest: Promise<ProjectCatalog> | undefined

export function getProjectCatalog(): Promise<ProjectCatalog> {
  catalogRequest ??= Promise.all([
    axiosInstance.get<{ items: CatalogItem[] }>('/catalogs/directions'),
    axiosInstance.get<{ items: CatalogItem[] }>('/catalogs/technologies'),
  ])
    .then(([directions, technologies]) => ({
      directions: directions.data.items,
      technologies: technologies.data.items,
    }))
    .catch((error) => {
      catalogRequest = undefined
      throw error
    })
  return catalogRequest
}
