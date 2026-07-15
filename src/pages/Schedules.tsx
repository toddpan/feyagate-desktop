import { useEffect, useState, useCallback } from 'react'
import {
  Card, Button, Tag, Empty, Table, message, Popconfirm,
  Modal, Form, Input, Select, DatePicker, Checkbox, Descriptions,
  Space, Row, Col,
} from 'antd'
import {
  ClockCircleOutlined, PlusOutlined, ReloadOutlined,
  DeleteOutlined, StopOutlined, InfoCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  scheduleList, scheduleAdd, scheduleDelete, scheduleCancel, scheduleGet,
  ScheduleTaskSummary, ScheduleTask,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'
import dayjs from 'dayjs'
import { PageHeader, SoftTag, StatTile } from '../components/ui'

const REPEAT_OPTIONS = [
  { value: 'none', label: '不重复（一次性）' },
  { value: 'daily', label: '每天' },
  { value: 'weekdays', label: '工作日' },
  { value: 'weekends', label: '周末' },
  { value: 'weekly', label: '每周' },
  { value: 'custom', label: '自定义' },
]

const WEEKDAY_OPTIONS = [
  { label: '周日', value: 0 },
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
]

const STATUS_MAP: Record<string, { tone: 'default' | 'success' | 'warning' | 'danger' | 'info'; text: string }> = {
  pending:   { tone: 'info', text: '待执行' },
  completed: { tone: 'success', text: '已完成' },
  failed:    { tone: 'danger', text: '失败' },
  cancelled: { tone: 'default', text: '已取消' },
}

const REPEAT_LABELS: Record<string, string> = {
  none: '不重复', daily: '每天', weekdays: '工作日',
  weekends: '周末', weekly: '每周', custom: '自定义',
}

function formatTime(ts: number) {
  if (!ts) return '-'
  return dayjs.unix(ts).format('YYYY-MM-DD HH:mm:ss')
}

export default function Schedules() {
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const [tasks, setTasks] = useState<ScheduleTaskSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [addVisible, setAddVisible] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [detailTask, setDetailTask] = useState<ScheduleTask | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [repeatType, setRepeatType] = useState('none')
  const [messageApi, contextHolder] = message.useMessage()
  const [form] = Form.useForm()

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      const data = await scheduleList()
      setTasks(data.tasks || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (serverOnline) fetchTasks()
  }, [serverOnline, fetchTasks])

  const handleAdd = async (values: Record<string, unknown>) => {
    try {
      setAddLoading(true)
      const time = (values.scheduled_time as dayjs.Dayjs).format('YYYY-MM-DDTHH:mm:ssZ')
      let repeatDays = ''
      if (values.repeat === 'custom' && Array.isArray(values.repeat_days)) {
        repeatDays = JSON.stringify(values.repeat_days)
      }
      const result = await scheduleAdd(
        values.name as string,
        time,
        values.tool_name as string,
        values.tool_args as string,
        (values.repeat as string) || 'none',
        repeatDays
      )
      if (result.success) {
        messageApi.success(`任务已创建 (ID: ${result.id})`)
        setAddVisible(false)
        form.resetFields()
        setRepeatType('none')
        fetchTasks()
      } else {
        messageApi.error(result.error || '创建失败')
      }
    } catch (e: unknown) {
      messageApi.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      setAddLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await scheduleDelete(id)
      messageApi.success('已删除')
      fetchTasks()
    } catch { messageApi.error('删除失败') }
  }

  const handleCancel = async (id: number) => {
    try {
      const r = await scheduleCancel(id)
      if (r.success) {
        messageApi.success('已取消')
        fetchTasks()
      } else {
        messageApi.error(r.error || '取消失败')
      }
    } catch { messageApi.error('取消失败') }
  }

  const handleDetail = async (id: number) => {
    try {
      const task = await scheduleGet(id)
      setDetailTask(task)
      setDetailVisible(true)
    } catch { messageApi.error('获取详情失败') }
  }

  const columns: ColumnsType<ScheduleTaskSummary> = [
    {
      title: 'ID', dataIndex: 'id', key: 'id', width: 60,
    },
    {
      title: '名称', dataIndex: 'name', key: 'name',
      ellipsis: true,
    },
    {
      title: '执行时间', dataIndex: 'scheduled_time', key: 'scheduled_time',
      render: (v: number) => <span style={{ fontSize: 12, color: 'var(--fg-text-secondary)' }}>{formatTime(v)}</span>,
      width: 170,
    },
    {
      title: '工具', dataIndex: 'tool_name', key: 'tool_name',
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '重复', dataIndex: 'repeat', key: 'repeat',
      render: (v: string) => (
        <SoftTag tone={v === 'none' ? 'default' : 'info'}>
          {REPEAT_LABELS[v] || v}
        </SoftTag>
      ),
      width: 90,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (v: string) => {
        const s = STATUS_MAP[v] || { tone: 'default' as const, text: v }
        return <SoftTag tone={s.tone} dot>{s.text}</SoftTag>
      },
      width: 90,
    },
    {
      title: '执行次数', dataIndex: 'execute_count', key: 'execute_count',
      width: 90, align: 'center',
    },
    {
      title: '操作', key: 'actions', width: 180,
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<InfoCircleOutlined />}
            onClick={() => handleDetail(record.id)}>
            详情
          </Button>
          {record.status === 'pending' && (
            <Popconfirm title="确定取消?" onConfirm={() => handleCancel(record.id)}>
              <Button type="link" size="small" danger icon={<StopOutlined />}>取消</Button>
            </Popconfirm>
          )}
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  if (!serverOnline) {
    return (
      <div className="fg-page">
        <PageHeader
          icon={<ClockCircleOutlined />}
          title="定时任务"
          subtitle="按计划自动触发 MCP 工具"
        />
        <div className="fg-empty-state">MCP Server 离线</div>
      </div>
    )
  }

  const pendingCount = tasks.filter((t) => t.status === 'pending').length
  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const failedCount = tasks.filter((t) => t.status === 'failed').length

  return (
    <div className="fg-page">
      {contextHolder}

      <PageHeader
        icon={<ClockCircleOutlined />}
        title="定时任务"
        subtitle={`${tasks.length} 个任务 · ${pendingCount} 待执行 · ${completedCount} 已完成`}
        extra={
          <Space>
            <Button icon={<RelOutline />} onClick={fetchTasks} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddVisible(true)}>
              新建任务
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} md={6}>
          <StatTile
            icon={<ClockCircleOutlined />}
            label="总任务"
            value={tasks.length}
            suffix="个"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatTile
            icon={<ClockCircleOutlined />}
            tone="info"
            label="待执行"
            value={pendingCount}
            suffix="个"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatTile
            icon={<ClockCircleOutlined />}
            tone="success"
            label="已完成"
            value={completedCount}
            suffix="个"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatTile
            icon={<ClockCircleOutlined />}
            tone={failedCount > 0 ? 'danger' : 'default'}
            label="失败"
            value={failedCount}
            suffix="个"
          />
        </Col>
      </Row>

      <Card className="fg-card-antd" bodyStyle={{ padding: 0 }}>
        <Table
          dataSource={tasks}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: <Empty description="暂无定时任务" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      </Card>

      {/* Add Task Modal */}
      <Modal
        title={
          <Space>
            <PlusOutlined /> 新建定时任务
          </Space>
        }
        open={addVisible}
        onCancel={() => { setAddVisible(false); form.resetFields(); setRepeatType('none') }}
        footer={null}
        width={580}
      >
        <Form form={form} layout="vertical" onFinish={handleAdd}
          initialValues={{ repeat: 'none' }}>
          <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如: 每天早上开灯" />
          </Form.Item>
          <Form.Item name="scheduled_time" label="执行时间" rules={[{ required: true, message: '请选择时间' }]}>
            <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" style={{ width: '100%' }}
              placeholder="选择执行时间" />
          </Form.Item>
          <Form.Item name="tool_name" label="MCP 工具名" rules={[{ required: true, message: '请输入工具名' }]}>
            <Input placeholder="如: set_xiaomi_device_property" />
          </Form.Item>
          <Form.Item name="tool_args" label="工具参数 (JSON)" rules={[{ required: true, message: '请输入参数' }]}>
            <Input.TextArea
              rows={3}
              placeholder={'如: {"device_id":"534345813","iid":"2.1","value":true}'}
            />
          </Form.Item>
          <Form.Item name="repeat" label="重复方式">
            <Select options={REPEAT_OPTIONS} onChange={(v) => setRepeatType(v)} />
          </Form.Item>
          {repeatType === 'custom' && (
            <Form.Item name="repeat_days" label="选择星期几">
              <Checkbox.Group options={WEEKDAY_OPTIONS} />
            </Form.Item>
          )}
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={addLoading}>
                创建任务
              </Button>
              <Button onClick={() => { setAddVisible(false); form.resetFields(); setRepeatType('none') }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Task Detail Modal */}
      <Modal
        title={<Space><InfoCircleOutlined />任务详情 #{detailTask?.id}</Space>}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={<Button onClick={() => setDetailVisible(false)}>关闭</Button>}
        width={640}
      >
        {detailTask && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="名称" span={2}>{detailTask.name}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <SoftTag tone={STATUS_MAP[detailTask.status]?.tone ?? 'default'} dot>
                {STATUS_MAP[detailTask.status]?.text || detailTask.status}
              </SoftTag>
            </Descriptions.Item>
            <Descriptions.Item label="重复">
              {REPEAT_LABELS[detailTask.repeat] || detailTask.repeat}
            </Descriptions.Item>
            <Descriptions.Item label="执行时间" span={2}>
              {formatTime(detailTask.scheduled_time)}
            </Descriptions.Item>
            <Descriptions.Item label="工具" span={2}>
              <Tag>{detailTask.tool_name}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="参数" span={2}>
              <pre className="fg-codeblock light" style={{ maxHeight: 160 }}>
                {detailTask.tool_args}
              </pre>
            </Descriptions.Item>
            {detailTask.repeat_days && detailTask.repeat_days > 0 && (
              <Descriptions.Item label="自定义星期" span={2}>
                <Space wrap size={4}>
                  <Tag>{WEEKDAY_OPTIONS[detailTask.repeat_days]?.label ?? detailTask.repeat_days}</Tag>
                </Space>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="创建时间">{formatTime(detailTask.created_at)}</Descriptions.Item>
            <Descriptions.Item label="上次执行">{formatTime(detailTask.executed_at)}</Descriptions.Item>
            <Descriptions.Item label="执行次数" span={2}>
              {detailTask.execute_count}
              {detailTask.result && (
                <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--fg-text-tertiary)' }}>
                  最近结果: {detailTask.result}
                </span>
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

// tiny shim so the JSX above works (we used a custom icon component name in template above)
function RelOutline() {
  return <ReloadOutlined />
}
