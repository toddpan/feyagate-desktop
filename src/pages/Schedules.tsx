import { useEffect, useState, useCallback } from 'react'
import {
  Card, Typography, Space, Button, Tag, Empty, Table, message, Popconfirm,
  Modal, Form, Input, Select, DatePicker, Checkbox, Descriptions, Badge,
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

const { Title, Text } = Typography

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

const STATUS_MAP: Record<string, { color: string; text: string }> = {
  pending:   { color: 'blue',    text: '待执行' },
  completed: { color: 'green',   text: '已完成' },
  failed:    { color: 'red',     text: '失败' },
  cancelled: { color: 'default', text: '已取消' },
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
        values.repeat as string || 'none',
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
      render: (v: number) => <Text style={{ fontSize: 12 }}>{formatTime(v)}</Text>,
      width: 170,
    },
    {
      title: '工具', dataIndex: 'tool_name', key: 'tool_name',
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '重复', dataIndex: 'repeat', key: 'repeat',
      render: (v: string) => <Tag color={v === 'none' ? 'default' : 'blue'}>{REPEAT_LABELS[v] || v}</Tag>,
      width: 90,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (v: string) => {
        const s = STATUS_MAP[v] || { color: 'default', text: v }
        return <Badge status={s.color as 'success' | 'processing' | 'error' | 'default'} text={s.text} />
      },
      width: 90,
    },
    {
      title: '执行次数', dataIndex: 'execute_count', key: 'execute_count',
      width: 80, align: 'center',
    },
    {
      title: '操作', key: 'actions', width: 160,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<InfoCircleOutlined />}
            onClick={() => handleDetail(record.id)}>
            详情
          </Button>
          {record.status === 'pending' && (
            <Popconfirm title="确定取消？" onConfirm={() => handleCancel(record.id)}>
              <Button type="link" size="small" danger icon={<StopOutlined />}>取消</Button>
            </Popconfirm>
          )}
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  if (!serverOnline) return <Empty description="MCP Server 离线" />

  const pendingCount = tasks.filter((t) => t.status === 'pending').length
  const completedCount = tasks.filter((t) => t.status === 'completed').length

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {contextHolder}
      <Space align="center" style={{ marginBottom: 16 }}>
        <ClockCircleOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ margin: 0 }}>定时任务</Title>
        <Tag color="blue">{pendingCount} 待执行</Tag>
        <Tag color="green">{completedCount} 已完成</Tag>
      </Space>

      <Card
        title={`任务列表 (${tasks.length})`}
        extra={
          <Space>
            <Button icon={<PlusOutlined />} type="primary"
              onClick={() => setAddVisible(true)}>
              新建任务
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchTasks} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={tasks}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: '暂无定时任务' }}
        />
      </Card>

      {/* Add Task Modal */}
      <Modal
        title="新建定时任务"
        open={addVisible}
        onCancel={() => { setAddVisible(false); form.resetFields(); setRepeatType('none') }}
        footer={null}
        width={560}
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
            <Input placeholder="如: xiaomi/send_ctrl_rpc, tuya/control, device/control" />
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
          <Form.Item>
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
        title={`任务详情 #${detailTask?.id || ''}`}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={<Button onClick={() => setDetailVisible(false)}>关闭</Button>}
        width={600}
      >
        {detailTask && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="名称" span={2}>{detailTask.name}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={STATUS_MAP[detailTask.status]?.color}>
                {STATUS_MAP[detailTask.status]?.text || detailTask.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="重复">
              {REPEAT_LABELS[detailTask.repeat] || detailTask.repeat}
            </Descriptions.Item>
            <Descriptions.Item label="执行时间" span={2}>
              {formatTime(detailTask.scheduled_time)}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {formatTime(detailTask.created_at)}
            </Descriptions.Item>
            <Descriptions.Item label="上次执行">
              {formatTime(detailTask.executed_at)}
            </Descriptions.Item>
            <Descriptions.Item label="执行次数">
              {detailTask.execute_count}
            </Descriptions.Item>
            <Descriptions.Item label="每日时刻">
              {detailTask.time_of_day > 0
                ? `${Math.floor(detailTask.time_of_day / 3600).toString().padStart(2, '0')}:${Math.floor((detailTask.time_of_day % 3600) / 60).toString().padStart(2, '0')}`
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="工具" span={2}>
              <Tag>{detailTask.tool_name}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="参数" span={2}>
              <pre style={{ margin: 0, fontSize: 12, maxHeight: 100, overflow: 'auto' }}>
                {detailTask.tool_args || '-'}
              </pre>
            </Descriptions.Item>
            {detailTask.result && (
              <Descriptions.Item label="执行结果" span={2}>
                <pre style={{ margin: 0, fontSize: 12, maxHeight: 120, overflow: 'auto' }}>
                  {detailTask.result}
                </pre>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
