import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Card, Typography, Space, Statistic, Row, Col, Select, Button,
  Empty, Spin, Tooltip as AntTooltip,
} from 'antd'
import {
  ThunderboltOutlined, SyncOutlined,
} from '@ant-design/icons'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  getTriggerSummary, TriggerSummaryResult,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'

const { Title, Text } = Typography
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

  if (!serverOnline) return <Empty description="MCP Server 离线" />

  const ov = data?.overview

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Space align="center" style={{ marginBottom: 16 }}>
        <ThunderboltOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ margin: 0 }}>触发事件统计</Title>
        <Select
          value={days}
          onChange={setDays}
          style={{ marginLeft: 16 }}
          options={[
            { value: 7, label: '最近 7 天' },
            { value: 30, label: '最近 30 天' },
            { value: 90, label: '最近 90 天' },
          ]}
        />
        <Button icon={<SyncOutlined spin={loading} />} onClick={fetchData}>刷新</Button>
      </Space>

      {loading && !data ? (
        <Card><Spin tip="加载中..." /></Card>
      ) : (
        <>
          {/* Overview */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card><Statistic title="今日触发" value={ov?.today ?? 0} suffix="次" /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="本周触发" value={ov?.this_week ?? 0} suffix="次" /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="累计触发" value={ov?.total ?? 0} suffix="次" /></Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="活跃规则"
                  value={ov?.enabled_rules ?? 0}
                  suffix={`/ ${ov?.total_rules ?? 0}`}
                />
              </Card>
            </Col>
          </Row>

          {/* Daily Trend */}
          <Card title="每日触发趋势" style={{ marginBottom: 16 }}>
            {data?.daily?.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.daily}>
                  <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="触发次数" fill="#1677ff" />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty description="暂无数据" />}
          </Card>

          {/* Heatmap */}
          <Card title="触发时间段分布（星期 × 小时）" style={{ marginBottom: 16 }}>
            {data?.heatmap?.length ? (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 30px)', gap: 2 }}>
                  {/* Header row */}
                  <div />
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} style={{ textAlign: 'center', fontSize: 10, color: '#999' }}>{h}</div>
                  ))}
                  {/* Data rows */}
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
            ) : <Empty description="暂无数据" />}
          </Card>

          {/* Rule ranking + Camera distribution */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Card title="规则触发排名">
                {data?.by_rule?.length ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data.by_rule.slice(0, 8)} layout="vertical">
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="rule_name" width={120} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="触发次数" fill="#1677ff" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty description="暂无数据" />}
              </Card>
            </Col>
            <Col span={12}>
              <Card title="摄像头触发分布">
                {data?.by_camera?.length ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={data.by_camera}
                        dataKey="count"
                        nameKey="camera_id"
                        cx="50%" cy="50%"
                        outerRadius={80}
                        label={(entry: any) => `${String(entry.camera_id).slice(-6)} ${((entry.percent as number) * 100).toFixed(0)}%`}
                      >
                        {data.by_camera.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `${v} 次`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <Empty description="暂无数据" />}
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}
