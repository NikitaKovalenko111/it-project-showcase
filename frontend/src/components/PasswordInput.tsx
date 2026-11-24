import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
export const PasswordInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  const [visible, setVisible] = useState(false)
  return (
    <div className="password-field">
      <input
        {...props}
        className={props.className || 'input'}
        type={visible ? 'text' : 'password'}
      />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
        aria-pressed={visible}
        title={visible ? 'Скрыть пароль' : 'Показать пароль'}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}
