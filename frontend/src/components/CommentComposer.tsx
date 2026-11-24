import { useEffect, useRef, useState } from 'react'
import { CommentAvatar } from './CommentAuthor'

export function CommentComposer({
  author,
  replyTo,
  disabled,
  maxLength,
  onSend,
  onCancel,
}: {
  author: { id: string; fullName: string; avatar?: string }
  replyTo?: string
  disabled?: boolean
  maxLength: number
  onSend: (message: string) => Promise<void>
  onCancel?: () => void
}) {
  const input = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const canSend = !!text.trim() && !disabled && !sending
  const isReply = onCancel !== undefined

  useEffect(() => {
    if (isReply) input.current?.focus()
  }, [replyTo, isReply])

  return (
    <form
      className="comment-composer"
      onSubmit={async (event) => {
        event.preventDefault()
        if (!canSend) return
        setSending(true)
        setError('')
        try {
          await onSend(text.trim())
          setText('')
        } catch (cause) {
          setError((cause as Error).message)
        } finally {
          setSending(false)
        }
      }}
    >
      <CommentAvatar id={author.id} name={author.fullName} avatar={author.avatar} />
      <div className="comment-composer__body">
        <label>
          <span className="sr-only">{onCancel ? 'Ваш ответ' : 'Ваш комментарий'}</span>
          <textarea
            ref={input}
            className="textarea"
            rows={2}
            data-min-rows="2"
            maxLength={maxLength}
            value={text}
            disabled={sending}
            placeholder={
              replyTo ? `Ответ для ${replyTo}` : isReply ? 'Введите ответ' : 'Введите комментарий'
            }
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
              event.preventDefault()
              if (canSend) event.currentTarget.form?.requestSubmit()
            }}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="comment-composer__footer">
          <span className="form-hint">Enter — отправить, Shift+Enter — новая строка</span>
          <div className="comment-composer__actions">
            {onCancel && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={sending}
                onClick={onCancel}
              >
                Отмена
              </button>
            )}
            <button type="submit" className="btn btn-primary btn-sm" disabled={!canSend}>
              {sending ? 'Отправляем…' : 'Отправить'}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}
