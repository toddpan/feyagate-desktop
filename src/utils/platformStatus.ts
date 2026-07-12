/**
 * 平台授权状态展示工具
 *
 * 服务端下发的 status 五值（详见 docs/design/platform-status-display.md）：
 *   licensed / free / trial_active / trial_expired / subscription_expired
 *
 * 注意：v2 文档 device-authorization-and-app-purchase.md §4.3 已约定 trial_active 状态的
 * 副标题同时支持"试用中·剩 N 天"（trialRemainingDays）+ "距宽限开始 N 天"
 * （subscription_expires_at）。订阅过期后进入 grace 期，由 grace_period_remaining 表达。
 */

export const PLATFORM_LABELS: Record<string, string> = {
  xiaomi: '米家',
  tuya: '涂鸦',
  midea: '美的',
  ewelink: '易微联',
  ha: 'HomeAssistant',
}

export type PlatformStatusKind =
  | 'licensed'
  | 'free'
  | 'trial_active'
  | 'trial_expired'
  | 'subscription_expired'

export interface PlatformStatusInfo {
  text: string
  color: string // antd Tag color 字符串
  /** 副文案（如到期/宽限剩余），供富文本展示 */
  hint?: string
}

/**
 * 把服务端 status 五值映射为 (text, color, hint)
 *
 * @param status 服务端原始 status 字符串（空/缺省时按 free 处理）
 * @param trialRemainingDays 试用剩余天数（仅 trial_active 有意义）
 * @param enabled 是否启用（enabled=false 时优先按 trial_expired 渲染）
 * @param expiresAt ISO8601 订阅到期时间
 * @param graceRemaining 宽限期剩余天数
 */
export function platformStatusInfo(
  status?: string | null,
  trialRemainingDays = 0,
  enabled = true,
  expiresAt?: string | null,
  graceRemaining = 0,
): PlatformStatusInfo {
  const s = (status || '').trim() as PlatformStatusKind

  if (s === 'licensed' || (!s && enabled)) {
    return { text: '授权版', color: 'gold' }
  }
  if (s === 'trial_active') {
    const days = trialRemainingDays > 0 ? trialRemainingDays : 1
    const hint = formatExpiryOrGrace(expiresAt, graceRemaining)
    return { text: `试用中 · 剩 ${days} 天`, color: 'blue', hint }
  }
  if (s === 'trial_expired') {
    return { text: '试用已到期', color: 'red' }
  }
  if (s === 'subscription_expired') {
    const hint = graceRemaining > 0 ? `宽限还剩 ${graceRemaining} 天` : '订阅已过期'
    return { text: '订阅已过期', color: 'volcano', hint }
  }
  // free / 缺省
  return { text: '免费', color: 'default' }
}

/**
 * 拼接到期/宽限副文案，统一与 Android GatewayDetailActivity 文案一致：
 *   - grace > 0 时优先显示「宽限还剩 N 天」
 *   - 否则显示「到期 YYYY-MM-DD」
 */
function formatExpiryOrGrace(expiresAt?: string | null, graceRemaining = 0): string | undefined {
  if (graceRemaining > 0) return `宽限还剩 ${graceRemaining} 天`
  if (expiresAt && expiresAt.length >= 10) return `到期 ${expiresAt.substring(0, 10)}`
  return undefined
}