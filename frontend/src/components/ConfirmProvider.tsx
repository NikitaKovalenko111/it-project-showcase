import React, { createContext, useCallback, useContext, useState } from 'react'
import { Modal } from './Modal'
type Confirm = (message: string, label?: string) => Promise<boolean>
type Request = {
  id: number
  message: string
  label: string
  withReason: boolean
  destructive: boolean
  resolve: (result: string | null) => void
}
type RequestConfirmation = (
  message: string,
  label?: string,
  withReason?: boolean,
  destructive?: boolean,
) => Promise<string | null>
const Context = createContext<RequestConfirmation | null>(null)
let sequence = 0
export const ConfirmProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [queue, setQueue] = useState<Request[]>([])
  const confirm = useCallback<RequestConfirmation>(
    (message, label = 'Подтвердить', withReason = false, destructive = false) =>
      new Promise((resolve) =>
        setQueue((q) => [
          ...q,
          { id: ++sequence, message, label, withReason, destructive, resolve },
        ]),
      ),
    [],
  )
  const [reason, setReason] = useState('')
  const current = queue[0]
  const finish = (result: string | null) => {
    current.resolve(result)
    setReason('')
    setQueue((q) => q.slice(1))
  }
  return (
    <Context.Provider value={confirm}>
      {children}
      {current && (
        <Modal key={current.id} title="Подтверждение действия" onClose={() => finish(null)}>
          <div className="modal-dialog__body">
            <p>{current.message}</p>
            {current.withReason && (
              <label>
                Причина (необязательно)
                <textarea
                  className="textarea"
                  value={reason}
                  maxLength={1000}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}
          </div>
          <div className="modal-dialog__footer">
            <button
              type="button"
              className="btn btn-secondary"
              autoFocus
              onClick={() => finish(null)}
            >
              Отмена
            </button>
            <button
              type="button"
              className={current.destructive ? 'btn btn-danger' : 'btn btn-primary'}
              onClick={() => finish(reason.trim())}
            >
              {current.label}
            </button>
          </div>
        </Modal>
      )}
    </Context.Provider>
  )
}
export const useConfirmWithReason = () => {
  const confirm = useContext(Context)
  if (!confirm) throw new Error('ConfirmProvider is missing')
  return confirm
}

export const useConfirm = (): Confirm => {
  const confirm = useConfirmWithReason()
  return useCallback(async (message, label) => (await confirm(message, label)) !== null, [confirm])
}
