export type PortfolioAttachment = { name: string; url: string; file_id?: string }

export function createPortfolioApi(http: any, baseUrl = '/api/v1') {
  const base = baseUrl.replace(/\/$/, '')
  return {
    async list(studentId: string, own: boolean): Promise<PortfolioAttachment[]> {
      const { data } = await http.get(
        own ? '/portfolio/me/files' : `/students/${studentId}/portfolio/files`,
      )
      return (data.items || [])
        .filter((f: any) => f.kind === 'certificate')
        .map((f: any) => ({
          name: f.original_name,
          file_id: f.file_id,
          url: own
            ? `${base}/files/${f.file_id}`
            : `${base}/students/${studentId}/portfolio/files/${f.file_id}`,
        }))
    },
    async add(files: PortfolioAttachment[]) {
      for (const f of files) {
        if (!f.file_id) throw new Error('Файл ещё не загружен на сервер')
        await http.post('/portfolio/me/files', {
          file_id: f.file_id,
          kind: 'certificate',
          visibility: 'public',
          is_default: false,
        })
      }
    },
    async remove(fileId: string) {
      await http.delete(`/portfolio/me/files/${fileId}`)
    },
  }
}
