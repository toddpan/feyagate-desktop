import React from 'react'

interface HeroProps {
  icon: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  tone?: 'default' | 'success' | 'warning' | 'danger'
}

export function Hero({
  icon,
  title,
  description,
  actions,
  tone = 'default',
}: HeroProps) {
  const cls = ['fg-hero']
  if (tone !== 'default') cls.push(tone)
  return (
    <div className={cls.join(' ')}>
      <div className="body">
        <span className="icon-wrap">{icon}</span>
        <div>
          <div className="heading">{title}</div>
          {description ? <div className="desc">{description}</div> : null}
        </div>
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
  )
}
