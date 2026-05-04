'use client'

import { useState, useRef, useEffect, useLayoutEffect, useMemo, type CSSProperties } from 'react'

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
}

interface TooltipState {
  text: string
  anchor: { top: number; bottom: number; left: number; right: number }
  style: CSSProperties
}

const LIST_MAX_H = 200
const TOOLTIP_W = 260
const MEASURING_STYLE: CSSProperties = { visibility: 'hidden', top: 0, left: 0, width: TOOLTIP_W }

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
}: Props) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [listStyle, setListStyle] = useState<CSSProperties>({})
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!open) setTooltip(null)
  }, [open])

  // Second pass: once tooltip is rendered hidden, measure and reposition
  useLayoutEffect(() => {
    if (!tooltip || tooltip.style !== MEASURING_STYLE || !tooltipRef.current) return
    const h = tooltipRef.current.offsetHeight
    const { top, bottom, left, right } = tooltip.anchor
    const spaceRight = window.innerWidth - right - 8
    const clampedLeft = Math.min(left, window.innerWidth - TOOLTIP_W - 8)
    let style: CSSProperties
    const spaceBelow = window.innerHeight - bottom - 8
    const raisedTop = Math.max(8, window.innerHeight - 8 - h)
    if (spaceBelow >= h) {
      style = { top: bottom + 4, left: clampedLeft, width: TOOLTIP_W }
    } else if (spaceRight >= TOOLTIP_W) {
      style = { top: raisedTop, left: right + 6, width: TOOLTIP_W }
    } else {
      style = { top: raisedTop, left: left - TOOLTIP_W - 6, width: TOOLTIP_W }
    }
    setTooltip(prev => prev ? { ...prev, style } : null)
  }, [tooltip])

  const currentOption = useMemo(() => options.find(o => o.value === value), [options, value])
  const currentLabel = currentOption?.label ?? value

  const filtered = useMemo(() => {
    if (!search) return maxUnfiltered > 0 ? options.slice(0, maxUnfiltered) : options
    const q = search.toLowerCase()
    return options.filter(o => String(o.label ?? '').toLowerCase().includes(q))
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
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
    setTooltip(null)
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

  function handleEnter(e: React.MouseEvent<HTMLElement>, desc: string) {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
    const rect = e.currentTarget.getBoundingClientRect()
    tooltipTimer.current = setTimeout(() => {
      setTooltip({
        text: desc,
        anchor: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
        style: MEASURING_STYLE,
      })
    }, 250)
  }

  function handleLeave() {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
    setTooltip(null)
  }

  return (
    <div className={'search-select' + (className ? ' ' + className : '')} ref={ref} onClick={e => e.stopPropagation()} onMouseLeave={handleLeave}>
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
      ) : (() => {
        const triggerDesc = value ? (getDescription ? getDescription(value) : currentOption?.description) : undefined
        return (
          <div
            className={'search-select-trigger' + (!value ? ' empty' : '') + (disabled ? ' locked' : '')}
            onMouseDown={disabled ? undefined : e => { e.stopPropagation(); openDropdown() }}
            onMouseEnter={triggerDesc ? e => handleEnter(e, triggerDesc) : undefined}
            onMouseLeave={triggerDesc ? handleLeave : undefined}
          >
            {currentOption?.image && value && (
              <img className="search-select-img" src={currentOption.image} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />
            )}
            <span className="search-select-trigger-label">{value ? currentLabel : placeholder}</span>
            {currentOption?.types?.map(t => (
              <span key={t} className="type-badge" style={{ background: `var(--${t})` }}>{t}</span>
            ))}
            {(() => { const m = getMeta ? getMeta(value) : currentOption?.meta; return m ? <span className="search-select-meta">{m}</span> : null })()}
          </div>
        )
      })()}
      {open && (
        <ul className="search-select-list" style={listStyle} onClick={e => e.stopPropagation()} onScroll={handleLeave}>
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
                    <span>{o.label}</span>
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
