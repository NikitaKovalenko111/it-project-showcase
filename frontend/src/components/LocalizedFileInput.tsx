import { useState, type ComponentProps } from 'react'

export function LocalizedFileInput({
  className,
  onChange,
  multiple,
  ...props
}: Omit<ComponentProps<'input'>, 'type'>) {
  const [names, setNames] = useState('')
  return (
    <span className="localized-file-input">
      <input
        {...props}
        type="file"
        multiple={multiple}
        className={className}
        onChange={(event) => {
          setNames(Array.from(event.currentTarget.files || [], (file) => file.name).join(', '))
          onChange?.(event)
          if (!event.currentTarget.value) setNames('')
        }}
      />
      <span className="localized-file-input__button" aria-hidden="true">
        {multiple ? 'Выбрать файлы' : 'Выбрать файл'}
      </span>
      <span className="localized-file-input__name" aria-hidden="true">
        {names || (multiple ? 'Файлы не выбраны' : 'Файл не выбран')}
      </span>
    </span>
  )
}
