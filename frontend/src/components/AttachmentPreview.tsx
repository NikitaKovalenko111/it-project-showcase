import { useState } from 'react'
import { Modal } from './Modal'
import { FileDownload } from './FileDownload'
export function AttachmentPreview({
  file,
  image,
}: {
  file: { name: string; url: string }
  image?: boolean
}) {
  const [open, setOpen] = useState(false)
  const photo =
    image ?? (/\.(png|jpe?g|webp|gif)$/i.test(file.name) || file.url.startsWith('data:image/'))
  return photo ? (
    <figure className="attachment-preview">
      <button
        type="button"
        className="attachment-preview__button"
        onClick={() => setOpen(true)}
        aria-label={'Посмотреть ' + file.name}
      >
        <img src={file.url} alt={file.name} />
      </button>
      <figcaption>{file.name}</figcaption>
      {open && (
        <Modal title={file.name} className="image-preview-dialog" onClose={() => setOpen(false)}>
          <div className="modal-dialog__body">
            <img src={file.url} alt={file.name} />
          </div>
        </Modal>
      )}
    </figure>
  ) : (
    <FileDownload file={file} />
  )
}
