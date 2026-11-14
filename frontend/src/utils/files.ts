import { storeMockFile } from './mockFiles'
import { apiRuntime } from '../api/runtime'
import { axiosInstance } from '../api/client'
async function upload(
  file: File,
): Promise<{ name: string; url: string; size: string; file_id?: string }> {
  const size = `${Math.ceil(file.size / 1024)} КБ`
  if (apiRuntime.mode === 'live') {
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
