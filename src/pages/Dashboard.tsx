import { useEffect, useState, useCallback } from 'react'
import {
  Card, Typography, Space, Statistic, Row, Col, Tag, List, Empty,
  Spin, Button, Badge, Progress,
} from 'antd'
import {
  DashboardOutlined, SyncOutlined, ThunderboltOutlined,
  EyeOutlined, ApiOutlined, ClockCircleOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  getDashboard, DashboardResult, getTokenUsage, DailyTokenStat,
  getCameraStatus, CameraStatusResult, getCameraList,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'

const { Title, Text } = Typography

export default function Dashboard() {
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const [dash, setDash] = useState<DashboardResult | null>(null)
  const [dailyTokens, setDailyTokens] = useState<DailyTokenStat[]>([])
  const [cameraStatus, setCameraStatus] = useState<CameraStatusResult | null>(null)
  const [totalCameras, setTotalCameras] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [dashData, tokenData, camStatus, camList] = await Promise.all([
        getDashboard(),
        getTokenUsage(7),
        getCameraStatus().catch(() => null),
        getCameraList().catch(() => null),
      ])
      setDash(dashData)
      setDailyTokens(tokenData.daily ?? [])
      if (camStatus) setCameraStatus(camStatus)
      if (camList) setTotalCameras(camList.cameras.length)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (serverOnline) fetchData()
  }, [serverOnline, fetchData])

  if (!serverOnline) return <Empty description="MCP Server 离线" />

  const today = dash?.today
  const tokenSummary = dash?.token_summary
  const connectedCameras = cameraStatus?.connected_count ?? 0

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Space align="center" style={{ marginBottom: 16 }}>
        <DashboardOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ margin: 0 }}>数据看板</Title>
        <Button icon={<SyncOutlined spin={loading} />} onClick={fetchData} style={{ marginLeft: 8 }}>
          刷新
        </Button>
      </Space>

      {loading && !dash ? (
        <Card><Spin tip="加载中..." /></Card>
      ) : (
        <>
          {/* System Status */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card>
                <Space direction="vertical" size={4}>
                  <Space><EyeOutlined /><Text strong>Vision AI</Text></Space>
                  <Tag color={tokenSummary?.total_calls ? 'green' : 'default'}>
                    {tokenSummary?.total_calls ? '已使用' : '未使用'}
                  </Tag>
                </Space>
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Space direction="vertical" size={4}>
                  <Space><ThunderboltOutlined /><Text strong>触发引擎</Text></Space>
                  <Tag color={dash?.trigger_engine?.enabled ? 'green' : 'default'}>
                    {dash?.trigger_engine?.enabled ? '运行中' : '未启用'}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dash?.trigger_engine?.enabled_rules ?? 0} / {dash?.trigger_engine?.total_rules ?? 0} 规则
                  </Text>
                </Space>
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Space direction="vertical" size={4}>
                  <Space><ApiOutlined /><Text strong>摄像头</Text></Space>
                  <Text>{connectedCameras} / {totalCameras} 在线</Text>
                  <Progress
                    percent={totalCameras > 0 ? Math.round(connectedCameras / totalCameras * 100) : 0}
                    size="small"
                    showInfo={false}
                  />
                </Space>
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Space direction="vertical" size={4}>
                  <Space><RobotOutlined /><Text strong>累计费用</Text></Space>
                  <Statistic
                    value={tokenSummary?.estimated_total_cost ?? 0}
                    precision={4}
                    prefix="¥"
                    valueStyle={{ fontSize: 20 }}
                  />
                </Space>
              </Card>
            </Col>
          </Row>

          {/* Today Overview */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="今日 AI 调用"
                  value={today?.ai_calls ?? 0}
                  suffix="次"
                  valueStyle={{ color: '#1677ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="今日触发"
                  value={today?.triggers ?? 0}
                  suffix="次"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="执行动作"
                  value={today?.actions_executed ?? 0}
                  suffix="次"
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Token 消耗"
                  value={today?.tokens_used ?? 0}
                  suffix="tokens"
                />
              </Card>
            </Col>
          </Row>

          {/* Token trend (7 days) + Recent Events */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={14}>
              <Card title="最近 7 天 Token 趋势">
                {dailyTokens.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dailyTokens}>
                      <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
                      <YAxis />
                      <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                      <Bar dataKey="prompt_tokens" name="Prompt" stackId="a" fill="#1677ff" />
                      <Bar dataKey="completion_tokens" name="Completion" stackId="a" fill="#52c41a" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty description="暂无数据" />}
              </Card>
            </Col>
            <Col span={10}>
              <Card title="最近触发事件">
                {dash?.recent_events?.length ? (
                  <List
                    size="small"
                    dataSource={dash.recent_events}
                    renderItem={(item) => (
                      <List.Item>
                        <Space direction="vertical" size={0}>
                          <Text strong>{item.rule_name}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            <ClockCircleOutlined style={{ marginRight: 4 }} />
                            {new Date(item.time).toLocaleString('zh-CN')}
                          </Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                ) : <Empty description="今日暂无触发" />}
              </Card>
            </Col>
          </Row>

          {/* Action Ranking */}
          {dash?.action_ranking?.length ? (
            <Card title="执行动作排名" style={{ marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height={Math.max(120, dash.action_ranking.length * 40)}>
                <BarChart data={dash.action_ranking} layout="vertical">
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="action" width={180} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="执行次数" fill="#1677ff" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          ) : null}
        </>
      )}
    </div>
  )
}
