import { apiRuntime } from '../api/runtime'
import { axiosInstance } from '../api/client'
async function upload(
  file: File,
  limitMb: number,
): Promise<{ name: string; url: string; size: string; file_id?: string }> {
  if (file.size > limitMb * 1024 * 1024) throw new Error(`Файл «${file.name}» больше ${limitMb} МБ`)
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
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsDataURL(file)
  })
  return { name: file.name, url, size }
}

export const uploadFile = (file: File) => upload(file, 2)
export const uploadResultFile = (file: File) =>
  upload(file, file.type.startsWith('video/') || /\.(mp4|webm)$/i.test(file.name) ? 20 : 2)
