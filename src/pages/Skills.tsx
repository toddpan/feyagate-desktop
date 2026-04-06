import { useEffect, useState, useCallback } from 'react'
import {
  Card, Typography, Space, Button, Input, Tag, Empty, message, Modal,
  Form, Result, Spin, List, Popconfirm, Segmented, Badge, Tooltip,
} from 'antd'
import {
  ThunderboltOutlined, PlusOutlined, ReloadOutlined, DeleteOutlined,
  EditOutlined, EyeOutlined, TagOutlined,
} from '@ant-design/icons'
import {
  skillList, skillRead, skillCreate, skillUpdate, skillDelete, skillReload,
  SkillItem, SkillDetail,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

const SOURCE_COLORS: Record<string, string> = {
  builtin: 'blue',
  user: 'green',
}

export default function Skills() {
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const [loading, setLoading] = useState(false)
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [filter, setFilter] = useState<string>('all')

  // View modal
  const [viewVisible, setViewVisible] = useState(false)
  const [viewDetail, setViewDetail] = useState<SkillDetail | null>(null)

  // Create/Edit modal
  const [editVisible, setEditVisible] = useState(false)
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create')
  const [editName, setEditName] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [form] = Form.useForm()

  const loadSkills = useCallback(async () => {
    setLoading(true)
    try {
      const res = await skillList(filter)
      setSkills(res.skills || [])
    } catch (e: unknown) {
      message.error('加载技能列表失败: ' + (e instanceof Error ? e.message : '未知错误'))
    }
    setLoading(false)
  }, [filter])

  useEffect(() => {
    if (serverOnline) loadSkills()
  }, [serverOnline, loadSkills])

  if (!serverOnline) {
    return <Result status="warning" title="MCP Server 离线" subTitle="请先启动 MCP Server" />
  }

  const handleView = async (name: string) => {
    try {
      const detail = await skillRead(name)
      setViewDetail(detail)
      setViewVisible(true)
    } catch (e: unknown) {
      message.error('读取技能失败: ' + (e instanceof Error ? e.message : '未知错误'))
    }
  }

  const handleOpenCreate = () => {
    setEditMode('create')
    setEditName('')
    setEditContent(`---
name: new-skill
description: "技能描述"
always: false
tags: ["scene"]
---

# 技能标题

在这里编写技能指令...
`)
    form.resetFields()
    setEditVisible(true)
  }

  const handleOpenEdit = async (name: string) => {
    try {
      const detail = await skillRead(name)
      setEditMode('edit')
      setEditName(name)
      setEditContent(detail.content)
      form.setFieldsValue({ name, content: detail.content })
      setEditVisible(true)
    } catch (e: unknown) {
      message.error('读取技能失败: ' + (e instanceof Error ? e.message : '未知错误'))
    }
  }

  const handleSave = async () => {
    setEditSaving(true)
    try {
      if (editMode === 'create') {
        const nameMatch = editContent.match(/^name:\s*(.+)$/m)
        const name = nameMatch ? nameMatch[1].trim().replace(/^["']|["']$/g, '') : editName || 'new-skill'
        const res = await skillCreate(name, editContent)
        if (res.success) {
          message.success(`技能 "${name}" 创建成功`)
          setEditVisible(false)
          loadSkills()
        } else {
          message.error(res.error || '创建失败')
        }
      } else {
        const res = await skillUpdate(editName, editContent)
        if (res.success) {
          message.success(`技能 "${editName}" 更新成功`)
          setEditVisible(false)
          loadSkills()
        } else {
          message.error(res.error || '更新失败')
        }
      }
    } catch (e: unknown) {
      message.error('保存失败: ' + (e instanceof Error ? e.message : '未知错误'))
    }
    setEditSaving(false)
  }

  const handleDelete = async (name: string) => {
    try {
      const res = await skillDelete(name)
      if (res.success) {
        message.success(`技能 "${name}" 已删除`)
        loadSkills()
      } else {
        message.error(res.error || '删除失败')
      }
    } catch (e: unknown) {
      message.error('删除失败: ' + (e instanceof Error ? e.message : '未知错误'))
    }
  }

  const handleReload = async () => {
    try {
      const res = await skillReload()
      if (res.success) {
        message.success(`技能缓存已刷新，共 ${res.skill_count} 个技能`)
        loadSkills()
      }
    } catch (e: unknown) {
      message.error('刷新失败: ' + (e instanceof Error ? e.message : '未知错误'))
    }
  }

  const filteredSkills = skills

  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space>
            <ThunderboltOutlined style={{ fontSize: 20 }} />
            <Title level={4} style={{ margin: 0 }}>技能管理</Title>
            <Tag>{skills.length} 个技能</Tag>
          </Space>
          <Space>
            <Segmented
              value={filter}
              onChange={(v) => setFilter(v as string)}
              options={[
                { label: '全部', value: 'all' },
                { label: '内置', value: 'builtin' },
                { label: '自定义', value: 'user' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={handleReload}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
              新建技能
            </Button>
          </Space>
        </Space>

        {filteredSkills.length === 0 ? (
          <Empty description="暂无技能" />
        ) : (
          <List
            grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
            dataSource={filteredSkills}
            renderItem={(item) => (
              <List.Item>
                <Card
                  size="small"
                  hoverable
                  title={
                    <Space>
                      <Text strong>{item.name}</Text>
                      <Tag color={SOURCE_COLORS[item.source] || 'default'}>
                        {item.source === 'builtin' ? '内置' : '自定义'}
                      </Tag>
                      {item.always && (
                        <Tooltip title="此技能始终激活，上下文中自动加载">
                          <Badge status="processing" text={<Text type="success" style={{ fontSize: 12 }}>常驻</Text>} />
                        </Tooltip>
                      )}
                    </Space>
                  }
                  actions={[
                    <Tooltip key="view" title="查看"><EyeOutlined onClick={() => handleView(item.name)} /></Tooltip>,
                    ...(item.source === 'user' ? [
                      <Tooltip key="edit" title="编辑"><EditOutlined onClick={() => handleOpenEdit(item.name)} /></Tooltip>,
                      <Popconfirm
                        key="del"
                        title={`删除技能 "${item.name}"？`}
                        onConfirm={() => handleDelete(item.name)}
                      >
                        <Tooltip title="删除"><DeleteOutlined style={{ color: '#ff4d4f' }} /></Tooltip>
                      </Popconfirm>,
                    ] : []),
                  ]}
                >
                  <Paragraph
                    ellipsis={{ rows: 2 }}
                    style={{ fontSize: 13, color: '#666', marginBottom: 8 }}
                  >
                    {item.description}
                  </Paragraph>
                  {item.tags?.length > 0 && (
                    <Space wrap size={4}>
                      {item.tags.map((t) => (
                        <Tag key={t} style={{ fontSize: 11 }} icon={<TagOutlined />}>{t}</Tag>
                      ))}
                    </Space>
                  )}
                </Card>
              </List.Item>
            )}
          />
        )}
      </Space>

      {/* View Modal */}
      <Modal
        title={viewDetail ? `技能: ${viewDetail.name}` : '技能详情'}
        open={viewVisible}
        onCancel={() => setViewVisible(false)}
        footer={null}
        width={700}
      >
        {viewDetail && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space wrap>
              <Tag color={SOURCE_COLORS[viewDetail.source]}>{viewDetail.source === 'builtin' ? '内置' : '自定义'}</Tag>
              {viewDetail.always && <Tag color="green">常驻</Tag>}
              {viewDetail.tags?.map((t) => <Tag key={t}>{t}</Tag>)}
            </Space>
            <Text type="secondary">{viewDetail.description}</Text>
            <pre style={{
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              background: '#fafafa', padding: 12, borderRadius: 6,
              fontSize: 13, maxHeight: 500, overflow: 'auto',
              border: '1px solid #f0f0f0',
            }}>
              {viewDetail.body || viewDetail.content}
            </pre>
          </Space>
        )}
      </Modal>

      {/* Create/Edit Modal */}
      <Modal
        title={editMode === 'create' ? '新建技能' : `编辑技能: ${editName}`}
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={handleSave}
        confirmLoading={editSaving}
        okText="保存"
        cancelText="取消"
        width={700}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">
            技能文件使用 Markdown 格式 + YAML frontmatter（name, description, always, tags）
          </Text>
          <TextArea
            rows={20}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
            placeholder={`---\nname: my-skill\ndescription: "技能描述"\nalways: false\ntags: ["scene"]\n---\n\n# 技能内容\n\n...`}
          />
        </Space>
      </Modal>
    </Spin>
  )
}
