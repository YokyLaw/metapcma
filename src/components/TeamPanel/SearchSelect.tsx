'use client'

import { useState, useRef, useEffect, type CSSProperties } from 'react'

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

const LIST_MAX_H = 200

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
  const [listStyle, setListStyle] = useState<CSSProperties>({})
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(id)
  }, [open])

  const currentOption = options.find(o => o.value === value)
  const currentLabel = currentOption?.label ?? value

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : maxUnfiltered > 0 ? options.slice(0, maxUnfiltered) : options

  function openDropdown() {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const below = window.innerHeight - rect.bottom - 4
      const above = rect.top - 4

      if (below >= LIST_MAX_H || below >= above) {
        setListStyle({
          top: rect.bottom + 2,
          left: rect.left,
          width: rect.width,
          maxHeight: Math.min(LIST_MAX_H, Math.max(below, 60)),
        })
      } else {
        setListStyle({
          bottom: window.innerHeight - rect.top + 2,
          left: rect.left,
          width: rect.width,
          maxHeight: Math.min(LIST_MAX_H, Math.max(above, 60)),
        })
      }
    }
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
          ref={inputRef}
          className="search-select-input"
          value={search}
          placeholder="Rechercher..."
          onChange={e => setSearch(e.target.value)}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === 'Enter' && filtered.length > 0) select(filtered[0].value)
          }}
        />
      ) : (
        <div
          className={'search-select-trigger' + (!value ? ' empty' : '') + (disabled ? ' locked' : '')}
          onMouseDown={disabled ? undefined : e => { e.stopPropagation(); openDropdown() }}
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
        <ul className="search-select-list" style={listStyle} onClick={e => e.stopPropagation()}>
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
