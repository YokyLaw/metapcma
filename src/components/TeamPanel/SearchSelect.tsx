'use client'

import { useState, useRef, useEffect } from 'react'

export interface SearchOption {
  value: string
  label: string
  meta?: string
  image?: string
}

interface Props {
  value: string
  options: SearchOption[]
  onChange: (value: string) => void
  placeholder?: string
  maxUnfiltered?: number
  disabled?: boolean
}

export default function SearchSelect({
  value,
  options,
  onChange,
  placeholder = '—',
  maxUnfiltered = 0,
  disabled = false,
}: Props) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const currentOption = options.find(o => o.value === value)
  const currentLabel = currentOption?.label ?? value

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : maxUnfiltered > 0 ? options.slice(0, maxUnfiltered) : options

  function handleFocus() {
    setSearch('')
    setOpen(true)
  }

  function select(val: string) {
    onChange(val)
    setSearch('')
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div className="search-select" ref={ref} onClick={e => e.stopPropagation()}>
      {open ? (
        <input
          className="search-select-input"
          value={search}
          placeholder="Rechercher..."
          autoFocus
          onChange={e => setSearch(e.target.value)}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <div
          className={'search-select-trigger' + (!value ? ' empty' : '') + (disabled ? ' locked' : '')}
          onMouseDown={disabled ? undefined : e => { e.stopPropagation(); handleFocus() }}
        >
          {currentOption?.image && value && (
            <img className="search-select-img" src={currentOption.image} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />
          )}
          <span className="search-select-trigger-label">{value ? currentLabel : placeholder}</span>
          {currentOption?.meta && (
            <span className="search-select-meta">{currentOption.meta}</span>
          )}
        </div>
      )}
      {open && (
        <ul className="search-select-list" onClick={e => e.stopPropagation()}>
          {placeholder && (
            <li
              className={'search-select-item' + (value === '' ? ' active' : '')}
              onMouseDown={() => select('')}
            >
              <span>{placeholder}</span>
            </li>
          )}
          {filtered.length === 0 ? (
            <li className="search-select-empty">Aucun résultat</li>
          ) : (
            filtered.map(o => (
              <li
                key={o.value || '__empty__'}
                className={'search-select-item' + (o.value === value ? ' active' : '')}
                onMouseDown={() => select(o.value)}
              >
                <span className="search-select-item-left">
                  {o.image && <img className="search-select-img" src={o.image} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />}
                  <span>{o.label}</span>
                </span>
                {o.meta && <span className="search-select-meta">{o.meta}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
