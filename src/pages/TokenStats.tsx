import { useEffect, useState, useCallback } from 'react'
import {
  Card, Row, Col, Tag, Table, Select,
  Button, Empty, Spin, Space,
} from 'antd'
import {
  DollarOutlined, ReloadOutlined, ThunderboltOutlined,
  ApiOutlined, RiseOutlined, CloseCircleFilled, CheckCircleFilled,
  FundOutlined,
} from '@ant-design/icons'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import {
  getTokenUsage, getTokenRecords, TokenUsageResult, TokenRecordItem,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'
import { Hero, PageHeader, StatTile } from '../components/ui'

const COLORS = ['#1677ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2']

export default function TokenStats() {
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const [data, setData] = useState<TokenUsageResult | null>(null)
  const [records, setRecords] = useState<TokenRecordItem[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [usage, recs] = await Promise.all([
        getTokenUsage(days),
        getTokenRecords(50),
      ])
      setData(usage)
      setRecords(recs.records ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    if (serverOnline) fetchData()
  }, [serverOnline, fetchData])

  if (!serverOnline) {
    return (
      <div className="fg-page">
        <PageHeader
          icon={<DollarOutlined />}
          title="Token 统计"
          subtitle="查看 AI 调用的 Token 消耗与费用"
        />
        <Hero tone="danger" icon={<CloseCircleFilled />} title="MCP Server 离线" />
      </div>
    )
  }

  const summary = data?.summary
  const sourceLabel: Record<string, string> = {
    vision_chat: '手动问答',
    trigger: '触发规则',
  }

  const successRate = summary && summary.total_calls
    ? Math.round((summary.total_calls - summary.total_failures) / summary.total_calls * 100)
    : null

  return (
    <div className="fg-page">
      <PageHeader
        icon={<DollarOutlined />}
        title="Token 统计"
        subtitle={`过去 ${days} 天的 AI 调用 Token 消耗与费用趋势`}
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
                label="今日消耗"
                value={(summary?.today_tokens ?? 0).toLocaleString()}
                suffix="tokens"
              />
            </Col>
            <Col xs={12} md={6}>
              <StatTile
                icon={<RiseOutlined />}
                label="本月累计"
                value={(summary?.month_tokens ?? 0).toLocaleString()}
                suffix="tokens"
              />
            </Col>
            <Col xs={12} md={6}>
              <StatTile
                icon={<FundOutlined />}
                tone="warning"
                label="总计消耗"
                value={(summary?.total_tokens ?? 0).toLocaleString()}
                suffix="tokens"
              />
            </Col>
            <Col xs={12} md={6}>
              <StatTile
                icon={<DollarOutlined />}
                tone="success"
                label="预估费用"
                value={(summary?.estimated_total_cost ?? 0).toFixed(4)}
                suffix="¥"
                trend={successRate != null ? `成功率 ${successRate}%` : '尚无数据'}
              />
            </Col>
          </Row>

          <Card className="fg-card-antd" title="每日 Token 消耗趋势" style={{ marginBottom: 20 }}>
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
                    tick={{ fill: 'var(--fg-text-tertiary)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid var(--fg-border)' }}
                    formatter={(v) => Number(v ?? 0).toLocaleString()}
                  />
                  <Legend />
                  <Bar dataKey="prompt_tokens" name="Prompt" stackId="a" fill="#1677ff" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="completion_tokens" name="Completion" stackId="a" fill="#52c41a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>

          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={24} lg={12}>
              <Card className="fg-card-antd" title="模型消耗占比">
                {data?.by_model?.length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={data.by_model}
                        dataKey="total_tokens"
                        nameKey="model"
                        cx="50%" cy="50%"
                        outerRadius={90}
                        label={(entry: { model?: string; percent?: number }) =>
                          `${entry.model} ${((entry.percent ?? 0) * 100).toFixed(0)}%`
                        }
                      >
                        {data.by_model.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `${Number(v).toLocaleString()} tokens`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card className="fg-card-antd" title="来源消耗占比">
                {data?.by_source?.length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={data.by_source.map((s) => ({ ...s, label: sourceLabel[s.source] || s.source }))}
                        dataKey="total_tokens"
                        nameKey="label"
                        cx="50%" cy="50%"
                        outerRadius={90}
                        label={(entry: { label?: string; percent?: number }) =>
                          `${entry.label} ${((entry.percent ?? 0) * 100).toFixed(0)}%`
                        }
                      >
                        {data.by_source.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `${Number(v).toLocaleString()} tokens`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
              </Card>
            </Col>
          </Row>

          <Card className="fg-card-antd" title="每日调用次数" style={{ marginBottom: 20 }}>
            {data?.daily?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.daily}>
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
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--fg-border)' }} />
                  <Legend />
                  <Line type="monotone" dataKey="calls" name="调用次数" stroke="#1677ff" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="failures" name="失败次数" stroke="#f5222d" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          </Card>

          <Card
            className="fg-card-antd"
            title={`调用记录 (最近 ${records.length} 条)`}
            bodyStyle={{ padding: 0 }}
          >
            <Table
              dataSource={records}
              rowKey="id"
              size="middle"
              pagination={{ pageSize: 10, showSizeChanger: false }}
              columns={[
                {
                  title: '时间', dataIndex: 'timestamp', width: 160,
                  render: (v: string) => new Date(v).toLocaleString('zh-CN'),
                },
                {
                  title: '来源', dataIndex: 'source', width: 100,
                  render: (v: string) => <Tag>{sourceLabel[v] || v}</Tag>,
                },
                { title: '模型', dataIndex: 'model', width: 160 },
                {
                  title: 'Tokens', dataIndex: 'total_tokens', width: 110,
                  render: (v: number) => v.toLocaleString(),
                },
                {
                  title: '状态', dataIndex: 'success', width: 80,
                  render: (v: boolean) => v
                    ? <CheckCircleFilled style={{ color: 'var(--fg-success)' }} />
                    : <CloseCircleFilled style={{ color: 'var(--fg-danger)' }} />,
                },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  )
}
