import { createId } from './id'
// Keep binary attachments out of localStorage so large files do not exhaust its small quota.
type StoredFile = { id: string; blob: Blob; urls: string[] }
const database = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('showcase-demo-files', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

async function write(db: IDBDatabase, records: StoredFile[]) {
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('files', 'readwrite')
    records.forEach((record) => transaction.objectStore('files').put(record))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export async function storeMockFile(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  let db: IDBDatabase | undefined
  try {
    db = await database()
    await write(db, [{ id: createId(), blob: file, urls: [url] }])
    return url
  } catch {
    URL.revokeObjectURL(url)
    throw new Error(
      'Не удалось сохранить файл в браузере. Проверьте доступное место и разрешение на хранение данных сайта.',
    )
  } finally {
    db?.close()
  }
}

export async function restoreMockFiles(): Promise<void> {
  const db = await database()
  try {
    const records = await new Promise<StoredFile[]>((resolve, reject) => {
      const request = db.transaction('files', 'readonly').objectStore('files').getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const entries = Object.keys(localStorage)
      .filter((key) => key.startsWith('uust_') || key.startsWith('showcase_'))
      .map((key) => ({ key, value: localStorage.getItem(key) || '' }))
    const replacements = new Map<string, string>()
    const changed: StoredFile[] = []
    for (const record of records) {
      if (!record.urls.some((url) => entries.some((entry) => entry.value.includes(url)))) continue
      const url = URL.createObjectURL(record.blob)
      record.urls.forEach((previous) => replacements.set(previous, url))
      changed.push({ ...record, urls: [...record.urls, url] })
    }
    // Persist aliases first; a later reload can resolve either the old or new metadata.
    if (changed.length) await write(db, changed)
    for (const entry of entries) {
      const updated = entry.value.replace(/blob:[^"\s\\]+/g, (url) => replacements.get(url) || url)
      if (updated !== entry.value) localStorage.setItem(entry.key, updated)
    }
  } finally {
    db.close()
  }
}
