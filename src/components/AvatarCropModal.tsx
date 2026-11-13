import { useEffect, useRef, useState } from 'react'
import { Modal } from './Modal'

const clamp = (value: number) => Math.max(-1, Math.min(1, value))

export function AvatarCropModal({
  file,
  onClose,
  onSave,
}: {
  file: File
  onClose: () => void
  onSave: (file: File) => Promise<void>
}) {
  const picture = useRef<HTMLImageElement>(null)
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number }>()
  const [url, setUrl] = useState('')
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const preview = URL.createObjectURL(file)
    setUrl(preview)
    return () => URL.revokeObjectURL(preview)
  }, [file])
  const edge = Math.min(dimensions.width, dimensions.height) / zoom
  const width = edge ? dimensions.width / edge : 1
  const height = edge ? dimensions.height / edge : 1
  const ready = !!dimensions.width
  const save = async () => {
    if (!ready || busy || !picture.current) return
    setBusy(true)
    setError('')
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 512
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Не удалось подготовить изображение.')
      const left = ((dimensions.width - edge) * (1 - position.x)) / 2
      const top = ((dimensions.height - edge) * (1 - position.y)) / 2
      context.drawImage(picture.current, left, top, edge, edge, 0, 0, 512, 512)
      const png = file.type === 'image/png'
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error('Не удалось обрезать фото.'))),
          png ? 'image/png' : 'image/jpeg',
          0.9,
        ),
      )
      const name = file.name.replace(/\.[^.]+$/, '') + (png ? '.png' : '.jpg')
      await onSave(new File([blob], name, { type: blob.type }))
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title="Обрезать фото профиля"
      onClose={onClose}
      busy={busy}
      className="avatar-crop-modal"
    >
      <div className="modal-dialog__body avatar-crop-body">
        <p>Переместите фото и выберите масштаб. В профиль сохранится область внутри рамки.</p>
        <div
          className="avatar-crop-area"
          aria-label="Предпросмотр обрезки фотографии"
          onPointerDown={(event) => {
            if (!ready || busy) return
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = {
              id: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              left: position.x,
              top: position.y,
            }
          }}
          onPointerMove={(event) => {
            const start = drag.current
            if (!start || start.id !== event.pointerId || busy) return
            const size = event.currentTarget.getBoundingClientRect().width
            setPosition({
              x:
                width > 1
                  ? clamp(start.left + (2 * (event.clientX - start.x)) / (size * (width - 1)))
                  : 0,
              y:
                height > 1
                  ? clamp(start.top + (2 * (event.clientY - start.y)) / (size * (height - 1)))
                  : 0,
            })
          }}
          onPointerUp={() => {
            drag.current = undefined
          }}
          onPointerCancel={() => {
            drag.current = undefined
          }}
          onLostPointerCapture={() => {
            drag.current = undefined
          }}
        >
          {url && (
            <img
              ref={picture}
              src={url}
              alt="Фото для обрезки"
              draggable={false}
              onLoad={(event) =>
                setDimensions({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              onError={() => setError('Не удалось открыть фото. Выберите другой файл.')}
              style={{
                width: width * 100 + '%',
                height: height * 100 + '%',
                left: 50 + position.x * (width - 1) * 50 + '%',
                top: 50 + position.y * (height - 1) * 50 + '%',
              }}
            />
          )}
        </div>
        <fieldset disabled={!dimensions.width || busy} className="avatar-crop-controls">
          <legend className="sr-only">Настройки обрезки</legend>
          <label>
            Масштаб
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </label>
          <label>
            По горизонтали
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={position.x}
              disabled={width <= 1}
              onChange={(event) =>
                setPosition((value) => ({ ...value, x: Number(event.target.value) }))
              }
            />
          </label>
          <label>
            По вертикали
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={position.y}
              disabled={height <= 1}
              onChange={(event) =>
                setPosition((value) => ({ ...value, y: Number(event.target.value) }))
              }
            />
          </label>
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="modal-dialog__footer">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => {
            setZoom(1)
            setPosition({ x: 0, y: 0 })
            setError('')
          }}
        >
          Сбросить
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
          Отмена
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!dimensions.width || busy}
          onClick={() => void save()}
        >
          {busy ? 'Сохранение…' : 'Сохранить фото'}
        </button>
      </div>
    </Modal>
  )
}
