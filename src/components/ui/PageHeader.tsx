import React from 'react'

interface PageHeaderProps {
  icon: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  extra?: React.ReactNode
}

export function PageHeader({ icon, title, subtitle, extra }: PageHeaderProps) {
  return (
    <div className="fg-page-header">
      <div className="fg-page-title">
        <span className="icon">{icon}</span>
        <div className="heading">
          <h2>{title}</h2>
          {subtitle ? <span className="subtitle">{subtitle}</span> : null}
        </div>
      </div>
      {extra ? <div className="fg-page-extra">{extra}</div> : null}
    </div>
  )
}
