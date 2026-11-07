import React, { createContext, useCallback, useContext, useState } from 'react'
import { Modal } from './Modal'
type Confirm = (message: string, label?: string) => Promise<boolean>
type Request = { id: number; message: string; label: string; resolve: (result: boolean) => void }
const Context = createContext<Confirm | null>(null)
let sequence = 0
export const ConfirmProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [queue, setQueue] = useState<Request[]>([])
  const confirm = useCallback<Confirm>(
    (message, label = 'Подтвердить') =>
      new Promise((resolve) =>
        setQueue((q) => [...q, { id: ++sequence, message, label, resolve }]),
      ),
    [],
  )
  const current = queue[0]
  const finish = (result: boolean) => {
    current.resolve(result)
    setQueue((q) => q.slice(1))
  }
  return (
    <Context.Provider value={confirm}>
      {children}
      {current && (
        <Modal key={current.id} title="Подтверждение действия" onClose={() => finish(false)}>
          <div className="modal-dialog__body">
            <p>{current.message}</p>
          </div>
          <div className="modal-dialog__footer">
            <button
              type="button"
              className="btn btn-secondary"
              autoFocus
              onClick={() => finish(false)}
            >
              Отмена
            </button>
            <button type="button" className="btn btn-primary" onClick={() => finish(true)}>
              {current.label}
            </button>
          </div>
        </Modal>
      )}
    </Context.Provider>
  )
}
export const useConfirm = () => {
  const confirm = useContext(Context)
  if (!confirm) throw new Error('ConfirmProvider is missing')
  return confirm
}
