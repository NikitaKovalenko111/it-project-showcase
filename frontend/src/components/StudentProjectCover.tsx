import { useEffect, useState, type CSSProperties } from 'react'
import { axiosInstance } from '../api/http'
import type { StudentProject, User } from '../types/models'

export function StudentProjectCover({
  project,
  viewer,
  style,
}: {
  project: StudentProject
  viewer?: User | null
  style?: CSSProperties
}) {
  const fileId = project.server?.coverFileId
  const viewerId = viewer?.id
  const isReviewer =
    (viewer?.role === 'curator' || viewer?.role === 'university') &&
    project.server?.status === 'moderation'
  const privatePath =
    !project.coverImage && fileId && viewerId
      ? viewerId === project.authorId || viewer.role === 'admin'
        ? `/files/${fileId}`
        : isReviewer
          ? `/student-projects/${project.id}/review/files/${fileId}`
          : ''
      : ''
  const [loaded, setLoaded] = useState<{ path: string; viewerId: string; src: string }>()

  useEffect(() => {
    if (!privatePath || !viewerId) return
    const controller = new AbortController()
    let url: string | undefined
    void axiosInstance
      .get<Blob>(privatePath, { responseType: 'blob', signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted || !data.type.startsWith('image/')) return
        url = URL.createObjectURL(data)
        setLoaded({ path: privatePath, viewerId, src: url })
      })
      .catch(() => {})
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [privatePath, viewerId])

  const src =
    project.coverImage ||
    (loaded?.path === privatePath && loaded.viewerId === viewerId ? loaded.src : undefined)

  return src ? <img src={src} alt="" loading="lazy" style={style} /> : null
}
