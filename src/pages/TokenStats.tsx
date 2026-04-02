import { useEffect, useState, useCallback } from 'react'
import {
  Card, Typography, Space, Statistic, Row, Col, Tag, Table, Select,
  Button, Empty, Spin,
} from 'antd'
import {
  DollarOutlined, SyncOutlined, ApiOutlined,
  CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import {
  getTokenUsage, getTokenRecords, TokenUsageResult, TokenRecordItem,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'

const { Title, Text } = Typography
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

  if (!serverOnline) return <Empty description="MCP Server 离线" />

  const summary = data?.summary
  const sourceLabel: Record<string, string> = {
    vision_chat: '手动问答',
    trigger: '触发规则',
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Space align="center" style={{ marginBottom: 16 }}>
        <DollarOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ margin: 0 }}>Token 消耗统计</Title>
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
          {/* Summary Cards */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card><Statistic title="今日消耗" value={summary?.today_tokens ?? 0} suffix="tokens" /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="本月累计" value={summary?.month_tokens ?? 0} suffix="tokens" /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="总计消耗" value={summary?.total_tokens ?? 0} suffix="tokens" /></Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="预估费用"
                  value={summary?.estimated_total_cost ?? 0}
                  precision={4}
                  prefix="¥"
                  suffix={<Text type="secondary" style={{ fontSize: 12 }}>(参考)</Text>}
                />
              </Card>
            </Col>
          </Row>

          {/* Daily Trend Chart */}
          <Card title="每日 Token 消耗趋势" style={{ marginBottom: 16 }}>
            {data?.daily?.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.daily}>
                  <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
                  <YAxis />
                  <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                  <Legend />
                  <Bar dataKey="prompt_tokens" name="Prompt" stackId="a" fill="#1677ff" />
                  <Bar dataKey="completion_tokens" name="Completion" stackId="a" fill="#52c41a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>

          {/* Model + Source Pie */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Card title="模型消耗占比">
                {data?.by_model?.length ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={data.by_model}
                        dataKey="total_tokens"
                        nameKey="model"
                        cx="50%" cy="50%"
                        outerRadius={80}
                        label={(entry: any) => `${entry.model} ${((entry.percent as number) * 100).toFixed(0)}%`}
                      >
                        {data.by_model.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => Number(v).toLocaleString() + ' tokens'} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <Empty description="暂无数据" />}
              </Card>
            </Col>
            <Col span={12}>
              <Card title="来源消耗占比">
                {data?.by_source?.length ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={data.by_source.map((s) => ({ ...s, label: sourceLabel[s.source] || s.source }))}
                        dataKey="total_tokens"
                        nameKey="label"
                        cx="50%" cy="50%"
                        outerRadius={80}
                        label={(entry: any) => `${entry.label} ${((entry.percent as number) * 100).toFixed(0)}%`}
                      >
                        {data.by_source.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => Number(v).toLocaleString() + ' tokens'} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <Empty description="暂无数据" />}
              </Card>
            </Col>
          </Row>

          {/* Call Count Trend */}
          <Card title="每日调用次数" style={{ marginBottom: 16 }}>
            {data?.daily?.length ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.daily}>
                  <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="calls" name="调用次数" stroke="#1677ff" />
                  <Line type="monotone" dataKey="failures" name="失败次数" stroke="#f5222d" />
                </LineChart>
              </ResponsiveContainer>
            ) : <Empty description="暂无数据" />}
          </Card>

          {/* Recent Records */}
          <Card title={`调用记录 (最近 ${records.length} 条)`}>
            <Table
              dataSource={records}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10 }}
              columns={[
                {
                  title: '时间', dataIndex: 'timestamp', width: 160,
                  render: (v: string) => new Date(v).toLocaleString('zh-CN'),
                },
                {
                  title: '来源', dataIndex: 'source', width: 90,
                  render: (v: string) => <Tag>{sourceLabel[v] || v}</Tag>,
                },
                { title: '模型', dataIndex: 'model', width: 140 },
                {
                  title: 'Tokens', dataIndex: 'total_tokens', width: 100,
                  render: (v: number) => v.toLocaleString(),
                },
                {
                  title: '状态', dataIndex: 'success', width: 70,
                  render: (v: boolean) => v
                    ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    : <CloseCircleOutlined style={{ color: '#f5222d' }} />,
                },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  )
}
