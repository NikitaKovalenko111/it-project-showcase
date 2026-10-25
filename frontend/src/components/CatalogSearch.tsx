import React from 'react'
import { Search, X } from 'lucide-react'

export const CatalogSearch: React.FC<{ value: string; onChange: (value: string) => void; label?: string }> = ({ value, onChange, label = 'Поиск проектов' }) => (
  <div className="catalog-search">
    <Search size={17} aria-hidden="true" />
    <input className="input" type="search" aria-label={label} placeholder={label} value={value} onChange={(event) => onChange(event.target.value)} />
    {value && <button className="close-btn" onClick={() => onChange('')} aria-label="Очистить поиск"><X size={16} /></button>}
  </div>
)
