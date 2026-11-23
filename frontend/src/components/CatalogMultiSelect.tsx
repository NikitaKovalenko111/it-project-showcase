import { useId, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

type Item = { id: string; name: string }
export function CatalogMultiSelect({
  label,
  items,
  value,
  onChange,
  limit,
}: {
  label: string
  items: Item[]
  value: string[]
  onChange: (ids: string[]) => void
  limit: number
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const visible = items.filter((item) =>
    item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  )
  return (
    <div className="catalog-multiselect">
      <span id={id} className="catalog-multiselect__label">
        {label}
      </span>
      <details>
        <summary aria-labelledby={id}>
          {value.length ? `Выбрано: ${value.length}` : `Выберите ${label.toLowerCase()}`}
          <ChevronDown size={16} />
        </summary>
        <div className="catalog-multiselect__menu">
          <label className="catalog-multiselect__search">
            <Search size={16} />
            <input
              className="input"
              aria-label={`Поиск: ${label}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти в списке"
            />
          </label>
          <div className="catalog-multiselect__options">
            {visible.map((item) => (
              <label key={item.id}>
                <input
                  type="checkbox"
                  checked={value.includes(item.id)}
                  disabled={!value.includes(item.id) && value.length >= limit}
                  onChange={(e) =>
                    onChange(
                      e.target.checked ? [...value, item.id] : value.filter((v) => v !== item.id),
                    )
                  }
                />
                <span>{item.name}</span>
              </label>
            ))}
            {!visible.length && <p>{items.length ? 'Ничего не найдено.' : 'Список пока пуст.'}</p>}
          </div>
        </div>
      </details>
      {!!value.length && (
        <div className="catalog-multiselect__selected">
          {items
            .filter((item) => value.includes(item.id))
            .map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => onChange(value.filter((v) => v !== item.id))}
                aria-label={`Убрать ${item.name}`}
              >
                {item.name}
                <X size={13} />
              </button>
            ))}
        </div>
      )}
      <small>Можно выбрать несколько значений, до {limit}.</small>
    </div>
  )
}
