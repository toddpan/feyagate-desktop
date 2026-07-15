import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Card, Row, Col, Select, Button,
  Empty, Spin, Tooltip as AntTooltip, Space,
} from 'antd'
import {
  ThunderboltOutlined, ReloadOutlined,
  RiseOutlined, AlertOutlined,
} from '@ant-design/icons'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { getTriggerSummary, TriggerSummaryResult } from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'
import { Hero, PageHeader, StatTile } from '../components/ui'

const COLORS = ['#1677ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16']
const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function HeatmapCell({ count, maxCount }: { count: number; maxCount: number }) {
  const intensity = maxCount > 0 ? count / maxCount : 0
  const bg = count === 0
    ? '#f0f0f0'
    : `rgba(22, 119, 255, ${0.15 + intensity * 0.85})`
  return (
    <AntTooltip title={`${count} 次`}>
      <div style={{
        width: 28, height: 28, borderRadius: 4, background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, color: intensity > 0.5 ? '#fff' : '#666',
        cursor: 'default',
      }}>
        {count > 0 ? count : ''}
      </div>
    </AntTooltip>
  )
}

export default function TriggerStats() {
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const [data, setData] = useState<TriggerSummaryResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getTriggerSummary(days)
      setData(res)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    if (serverOnline) fetchData()
  }, [serverOnline, fetchData])

  const heatmapData = useMemo(() => {
    if (!data?.heatmap?.length) return { grid: Array.from({ length: 7 }, () => Array(24).fill(0)), max: 0 }
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0))
    let max = 0
    for (const h of data.heatmap) {
      grid[h.weekday_idx][h.hour] = h.count
      if (h.count > max) max = h.count
    }
    return { grid, max }
  }, [data])

  if (!serverOnline) {
    return (
      <div className="fg-page">
        <PageHeader
          icon={<ThunderboltOutlined />}
          title="触发统计"
          subtitle="分析触发规则的活跃度与分布"
        />
        <Hero tone="danger" icon={<AlertOutlined />} title="MCP Server 离线" />
      </div>
    )
  }

  const ov = data?.overview

  return (
    <div className="fg-page">
      <PageHeader
        icon={<ThunderboltOutlined />}
        title="触发统计"
        subtitle={`过去 ${days} 天的触发事件分布`}
        extra={
          <Space>
            <Select
              value={days}
              onChange={setDays}
              style={{ width: 160 }}
              options={[
                { value: 7, label: '最近 7 天' },
                { value: 30, label: '最近 30 天' },
                { value: 90, label: '最近 90 天' },
              ]}
            />
            <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchData} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      />

      {loading && !data ? (
        <Card className="fg-card-antd">
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Spin tip="加载中..." />
          </div>
        </Card>
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={12} md={6}>
              <StatTile
                icon={<ThunderboltOutlined />}
                tone="info"
                label="今日触发"
                value={ov?.today ?? 0}
                suffix="次"
              />
            </Col>
            <Col xs={12} md={6}>
              <StatTile
                icon={<RiseOutlined />}
                label="本周触发"
                value={ov?.this_week ?? 0}
                suffix="次"
              />
            </Col>
            <Col xs={12} md={6}>
              <StatTile
                icon={<ThunderboltOutlined />}
                tone="warning"
                label="累计触发"
                value={ov?.total ?? 0}
                suffix="次"
              />
            </Col>
            <Col xs={12} md={6}>
              <StatTile
                icon={<AlertOutlined />}
                tone="success"
                label="活跃规则"
                value={ov?.enabled_rules ?? 0}
                suffix={`/ ${ov?.total_rules ?? 0} 启用`}
              />
            </Col>
          </Row>

          <Card className="fg-card-antd" title="每日触发趋势" style={{ marginBottom: 20 }}>
            {data?.daily?.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.daily} barCategoryGap="32%">
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => v.slice(5)}
                    tick={{ fill: 'var(--fg-text-tertiary)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: 'var(--fg-text-tertiary)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid var(--fg-border)' }}
                  />
                  <Bar dataKey="count" name="触发次数" fill="#1677ff" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          </Card>

          <Card className="fg-card-antd" title="触发时间段分布（星期 × 小时）" style={{ marginBottom: 20 }}>
            {data?.heatmap?.length ? (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 30px)', gap: 2 }}>
                  <div />
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} style={{ textAlign: 'center', fontSize: 10, color: '#999' }}>{h}</div>
                  ))}
                  {WEEKDAYS.map((wd, wIdx) => (
                    <>
                      <div key={`label-${wIdx}`} style={{ fontSize: 12, lineHeight: '28px', textAlign: 'right', paddingRight: 4 }}>
                        {wd}
                      </div>
                      {Array.from({ length: 24 }, (_, h) => (
                        <HeatmapCell
                          key={`${wIdx}-${h}`}
                          count={heatmapData.grid[wIdx][h]}
                          maxCount={heatmapData.max}
                        />
                      ))}
                    </>
                  ))}
                </div>
              </div>
            ) : <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          </Card>

          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={24} lg={12}>
              <Card className="fg-card-antd" title="规则触发排名 (Top 8)">
                {data?.by_rule?.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.by_rule.slice(0, 8)} layout="vertical" barCategoryGap="32%">
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fill: 'var(--fg-text-tertiary)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="rule_name"
                        width={140}
                        tick={{ fill: 'var(--fg-text-secondary)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--fg-border)' }} />
                      <Bar dataKey="count" name="触发次数" fill="#1677ff" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card className="fg-card-antd" title="摄像头触发分布">
                {data?.by_camera?.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.by_camera}
                        dataKey="count"
                        nameKey="camera_id"
                        cx="50%" cy="50%"
                        outerRadius={90}
                        label={(entry: { camera_id?: string; percent?: number }) =>
                          `${String(entry.camera_id ?? '').slice(-6)} ${((entry.percent ?? 0) * 100).toFixed(0)}%`
                        }
                      >
                        {data.by_camera.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `${v} 次`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}
