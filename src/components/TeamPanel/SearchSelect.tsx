'use client'

import { useState, useRef, useEffect, useMemo, type CSSProperties } from 'react'

import { POKEMON_TRANSLATIONS, TYPE_TRANSLATIONS } from '../../data/translations'
import { useDescTooltip } from '../../hooks/useDescTooltip'

export interface SearchOption {
  value: string
  label: string
  meta?: string
  image?: string
  disabled?: boolean
  description?: string
  types?: string[]
}

interface Props {
  value: string
  options: SearchOption[]
  onChange: (value: string) => void
  placeholder?: string
  maxUnfiltered?: number
  disabled?: boolean
  className?: string
  getDescription?: (value: string) => string | undefined
  getMeta?: (value: string) => string | undefined
  showSearchIcon?: boolean
}

const LIST_MAX_H = 200

export default function SearchSelect({
  value,
  options,
  onChange,
  placeholder = '—',
  maxUnfiltered = 0,
  disabled = false,
  className = '',
  getDescription,
  getMeta,
  showSearchIcon = false,
}: Props) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [listStyle, setListStyle] = useState<CSSProperties>({})
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { tooltip, tooltipRef, handleEnter, handleLeave } = useDescTooltip()

  const translate = (val: string) => POKEMON_TRANSLATIONS[val] || val

  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!open) handleLeave()
  }, [open])

  const currentOption = useMemo(() => options.find(o => o.value === value), [options, value])
  const currentLabel = currentOption ? translate(currentOption.label) : translate(value)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const allFiltered = options.filter(o => {
      const fr = (POKEMON_TRANSLATIONS[o.label] || '').toLowerCase()
      const en = o.label.toLowerCase()
      return en.includes(q) || fr.includes(q)
    })
    if (!search && maxUnfiltered > 0) return allFiltered.slice(0, maxUnfiltered)
    return allFiltered
  }, [options, search, maxUnfiltered])

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
    handleLeave()
  }

  function select(val: string) {
    handleLeave()
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
    <div className={'search-select' + (className ? ' ' + className : '')} ref={ref} onClick={e => e.stopPropagation()} onMouseLeave={handleLeave}>
      {open ? (
        <div className="search-input-wrapper">
          {showSearchIcon && <span className="search-icon">🔍</span>}
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
        </div>
      ) : (() => {
        const triggerDesc = value ? (getDescription ? getDescription(value) : currentOption?.description) : undefined
        return (
          <div
            className={'search-select-trigger' + (!value ? ' empty' : '') + (disabled ? ' locked' : '')}
            onMouseDown={disabled ? undefined : e => { e.stopPropagation(); openDropdown() }}
            onMouseEnter={triggerDesc ? e => handleEnter(e, triggerDesc) : undefined}
            onMouseLeave={triggerDesc ? handleLeave : undefined}
          >
            {showSearchIcon && !value && <span className="search-icon-placeholder">🔍</span>}
            {currentOption?.image && value && (
              <img className="search-select-img" src={currentOption.image} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />
            )}
            <span className="search-select-trigger-label">{value ? currentLabel : placeholder}</span>
            {currentOption?.types?.map(t => (
              <span key={t} className="type-badge" style={{ background: `var(--type-${t.toLowerCase()})` }}>
                {TYPE_TRANSLATIONS[t] || t}
              </span>
            ))}
            {(() => { const m = getMeta ? getMeta(value) : currentOption?.meta; return m ? <span className="search-select-meta">{m}</span> : null })()}
          </div>
        )
      })()}
      {open && (
        <ul
          className="search-select-list"
          style={listStyle}
          onClick={e => e.stopPropagation()}
          onScroll={handleLeave}
          onWheel={e => {
            e.preventDefault()
            e.currentTarget.scrollTop += Math.sign(e.deltaY) * 20
          }}
        >
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
            filtered.map(o => {
              const desc = getDescription ? getDescription(o.value) : o.description
              return (
                <li
                  key={o.value || '__empty__'}
                  className={'search-select-item' + (o.value === value ? ' active' : '') + (o.disabled ? ' disabled' : '')}
                  onMouseDown={o.disabled ? undefined : () => select(o.value)}
                  onMouseEnter={desc ? e => handleEnter(e, desc) : undefined}
                  onMouseLeave={desc ? handleLeave : undefined}
                >
                  <span className="search-select-item-left">
                    {o.image && <img className="search-select-img" src={o.image} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />}
                    <span>{translate(o.label)}</span>
                  </span>
                  {(() => { const m = getMeta ? getMeta(o.value) : o.meta; return m ? <span className="search-select-meta">{m}</span> : null })()}
                </li>
              )
            })
          )}
        </ul>
      )}
      {tooltip && (
        <div ref={tooltipRef} className="search-select-desc-tooltip" style={tooltip.style}>
          {tooltip.text.split('\n').map((line, i, arr) => (
            <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
          ))}
        </div>
      )}
    </div>
  )
}

