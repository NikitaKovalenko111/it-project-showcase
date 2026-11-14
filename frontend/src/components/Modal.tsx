import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/** A top-layer dialog stays outside card transforms and keeps keyboard focus inside. */
export const Modal: React.FC<
  React.PropsWithChildren<{
    title: string
    onClose: () => void
    busy?: boolean
    className?: string
    bare?: boolean
  }>
> = ({ title, onClose, busy, className = '', bare = false, children }) => {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current,
      previous = document.activeElement as HTMLElement | null
    dialog?.showModal()
    return () => {
      dialog?.close()
      previous?.focus()
    }
  }, [])
  return createPortal(
    <dialog
      ref={ref}
      role="dialog"
      aria-modal="true"
      className={`modal-dialog portal-dialog ${className}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onClose()
      }}
    >
      {!bare && (
        <div className="modal-dialog__header">
          <h3>{title}</h3>
          <button
            type="button"
            className="close-btn"
            aria-label="Закрыть окно"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
      )}
      {children}
    </dialog>,
    document.body,
  )
}
