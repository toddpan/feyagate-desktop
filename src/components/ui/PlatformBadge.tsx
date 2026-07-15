import React from 'react'

interface PlatformDotProps {
  platform: string
  size?: number
}

export const PLATFORM_PRESET: Record<string, { label: string; color: string }> = {
  xiaomi: { label: '米家', color: 'var(--fg-p-xiaomi)' },
  tuya: { label: '涂鸦', color: 'var(--fg-p-tuya)' },
  midea: { label: '美的', color: 'var(--fg-p-midea)' },
  ewelink: { label: '易微联', color: 'var(--fg-p-ewelink)' },
  ha: { label: 'HA', color: 'var(--fg-p-ha)' },
}

export function PlatformLabel({ id, fallback }: { id: string; fallback?: string }) {
  return <>{PLATFORM_PRESET[id]?.label ?? fallback ?? id}</>
}

interface DotProps {
  platform: string
  size?: number
}

export function PlatformDot({ platform, size = 8 }: DotProps) {
  const color = PLATFORM_PRESET[platform]?.color ?? 'var(--fg-text-tertiary)'
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
  )
}
