import React from 'react'

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info'

interface StatTileProps {
  icon?: React.ReactNode
  label: React.ReactNode
  value: React.ReactNode
  suffix?: React.ReactNode
  trend?: React.ReactNode
  tone?: Tone
  style?: React.CSSProperties
}

export function StatTile({
  icon,
  label,
  value,
  suffix,
  trend,
  tone = 'default',
  style,
}: StatTileProps) {
  const iconWrap = icon
    ? React.cloneElement(icon as React.ReactElement, {
        style: { color: `var(--fg-${tone === 'default' ? 'text-secondary' : tone})` },
      })
    : null
  return (
    <div className="fg-stat" style={style}>
      <span className="label">
        {iconWrap}
        {label}
      </span>
      <span className="value">
        {value}
        {suffix ? <span className="suffix">{suffix}</span> : null}
      </span>
      {trend ? <span className="trend">{trend}</span> : null}
    </div>
  )
}
