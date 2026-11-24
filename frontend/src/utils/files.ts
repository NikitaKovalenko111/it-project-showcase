import { storeMockFile } from './mockFiles'
import { apiRuntime } from '../api/runtime'
import { axiosInstance } from '../api/client'
async function upload(
  file: File,
): Promise<{ name: string; url: string; size: string; file_id?: string }> {
  const size = `${Math.ceil(file.size / 1024)} КБ`
  if (apiRuntime.mode === 'live') {
    if (file.type.startsWith('video/')) {
      if (!['video/mp4', 'video/webm'].includes(file.type))
        throw new Error('Для видео выберите MP4 или WebM.')
      if (file.size > 20 * 1024 * 1024) throw new Error('Видео должно быть не больше 20 МиБ.')
    }
    const body = new FormData()
    body.append('file', file)
    const { data } = await axiosInstance.post('/files', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    if (!data.file_id) throw new Error('Сервер не вернул file_id и URL загруженного файла')
    return {
      name: file.name,
      url: `${apiRuntime.baseUrl || '/api/v1'}/files/${data.file_id}`,
      size,
      file_id: data.file_id,
    }
  }
  const url = await storeMockFile(file)
  return { name: file.name, url, size }
}

export const uploadFile = (file: File) => upload(file)
export const uploadResultFile = (file: File) => upload(file)
