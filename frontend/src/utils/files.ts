import { apiRuntime } from '../api/runtime'
import { axiosInstance } from '../api/client'
export async function uploadFile(file: File): Promise<{ name: string; url: string; size: string; file_id?: string }> {
  if (file.size > 2 * 1024 * 1024) throw new Error(`Файл «${file.name}» больше 2 МБ`)
  const size = `${Math.ceil(file.size / 1024)} КБ`
  if (apiRuntime.mode === 'live') {
    const body = new FormData(); body.append('file', file)
    const { data } = await axiosInstance.post('/files/upload', body, { headers: { 'Content-Type': 'multipart/form-data' } })
    if (!data.file_id || !data.url) throw new Error('Сервер не вернул file_id и URL загруженного файла')
    return { name: file.name, url: data.url, size, file_id: data.file_id }
  }
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Не удалось прочитать файл')); reader.readAsDataURL(file)
  })
  return { name: file.name, url, size }
}
