import { useEffect, useState, useCallback } from 'react'
import {
  Card, Typography, Space, Button, Tag, Empty, Spin, Timeline, Select,
  Descriptions, Alert,
} from 'antd'
import {
  HistoryOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons'
import { triggerLogs, triggerList, TriggerLog, TriggerRule } from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'

const { Title, Text } = Typography

export default function TriggerLogs() {
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const [logs, setLogs] = useState<TriggerLog[]>([])
  const [rules, setRules] = useState<TriggerRule[]>([])
  const [loading, setLoading] = useState(true)
  const [filterRuleId, setFilterRuleId] = useState<string>('')

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      const res = await triggerLogs(100, filterRuleId || undefined)
      setLogs(res.logs ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [filterRuleId])

  const fetchRules = useCallback(async () => {
    try {
      const res = await triggerList()
      setRules(res.rules ?? [])
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (serverOnline) {
      fetchLogs()
      fetchRules()
    }
  }, [serverOnline, fetchLogs, fetchRules])

  if (!serverOnline) {
    return <Empty description="MCP Server 离线" />
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Space align="center" style={{ marginBottom: 16 }}>
        <HistoryOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ margin: 0 }}>触发日志</Title>
      </Space>

      <Card
        title={`触发记录 (${logs.length})`}
        extra={
          <Space>
            <Select
              allowClear
              placeholder="按规则筛选"
              style={{ width: 200 }}
              value={filterRuleId || undefined}
              onChange={(v) => setFilterRuleId(v || '')}
              options={rules.map((r) => ({ value: r.id, label: r.name }))}
            />
            <Button icon={<SyncOutlined spin={loading} />} onClick={fetchLogs}>
              刷新
            </Button>
          </Space>
        }
      >
        {loading ? (
          <Spin tip="加载中..." />
        ) : logs.length === 0 ? (
          <Empty description="暂无触发记录" />
        ) : (
          <Timeline
            items={logs.map((log) => ({
              color: log.actions_executed?.length > 0 ? 'green' : 'blue',
              dot: log.actions_executed?.length > 0
                ? <CheckCircleOutlined />
                : <CloseCircleOutlined />,
              children: (
                <Card size="small" style={{ marginBottom: 8 }}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="时间">
                      {new Date(log.triggered_at).toLocaleString('zh-CN')}
                    </Descriptions.Item>
                    <Descriptions.Item label="规则">
                      <Tag>{log.rule_name}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="条件">
                      {log.condition}
                    </Descriptions.Item>
                    <Descriptions.Item label="摄像头">
                      {log.camera_id} (通道 {log.channel})
                    </Descriptions.Item>
                    {log.actions_executed?.length > 0 && (
                      <Descriptions.Item label="执行动作">
                        {log.actions_executed.map((a, i) => (
                          <Tag key={i} color="green">{a}</Tag>
                        ))}
                      </Descriptions.Item>
                    )}
                    {log.llm_response && (
                      <Descriptions.Item label="LLM 响应">
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {log.llm_response.substring(0, 200)}
                        </Text>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>
              ),
            }))}
          />
        )}
      </Card>
    </div>
  )
}
