import React from 'react'

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info'

interface SoftTagProps {
  tone?: Tone
  dot?: boolean
  children: React.ReactNode
  style?: React.CSSProperties
}

export function SoftTag({ tone = 'default', dot, children, style }: SoftTagProps) {
  const cls = ['fg-soft-tag']
  if (tone !== 'default') cls.push(tone)
  return (
    <span className={cls.join(' ')} style={style}>
      {dot ? <span className="dot" /> : null}
      {children}
    </span>
  )
}
