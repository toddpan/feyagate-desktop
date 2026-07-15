import { useEffect, useState, useCallback } from 'react'
import {
  Button, Input, Empty, message, Modal,
  Form, Spin, Row, Col, Space,
} from 'antd'
import {
  PlusOutlined, ReloadOutlined, DeleteOutlined,
  EditOutlined, EyeOutlined, ThunderboltOutlined,
  TagOutlined, FilterOutlined, BookOutlined,
} from '@ant-design/icons'
import {
  skillList, skillRead, skillCreate, skillUpdate, skillDelete, skillReload,
  SkillItem, SkillDetail,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'
import { PageHeader, SoftTag } from '../components/ui'

const { TextArea } = Input

const SOURCE_LABEL: Record<string, string> = {
  builtin: '内置',
  user: '自定义',
}

export default function Skills() {
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const [loading, setLoading] = useState(false)
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [filter, setFilter] = useState<string>('all')

  const [viewVisible, setViewVisible] = useState(false)
  const [viewDetail, setViewDetail] = useState<SkillDetail | null>(null)

  const [editVisible, setEditVisible] = useState(false)
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create')
  const [editName, setEditName] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editSaving, setEditSaving] = useState(false)

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
    return (
      <div className="fg-page">
        <PageHeader
          icon={<ThunderboltOutlined />}
          title="技能"
          subtitle="自定义 AI 指令与场景能力"
        />
        <div className="fg-empty-state">MCP Server 离线</div>
      </div>
    )
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
    setEditVisible(true)
  }

  const handleOpenEdit = async (name: string) => {
    try {
      const detail = await skillRead(name)
      setEditMode('edit')
      setEditName(name)
      setEditContent(detail.content)
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

  const builtinCount = skills.filter((s) => s.source === 'builtin').length
  const customCount = skills.filter((s) => s.source === 'user').length

  return (
    <div className="fg-page">
      <PageHeader
        icon={<ThunderboltOutlined />}
        title="技能"
        subtitle={`共 ${skills.length} 个技能 · ${builtinCount} 内置 · ${customCount} 自定义`}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleReload}>刷新缓存</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
              新建技能
            </Button>
          </Space>
        }
      />

      <div className="fg-toolbar">
        <div className="left">
          <SoftTag tone="info">
            <FilterOutlined style={{ marginRight: 4 }} />
            {filter === 'all' && '全部'}
            {filter === 'builtin' && '内置'}
            {filter === 'user' && '自定义'}
          </SoftTag>
        </div>
        <div className="right">
          <Space>
            {[
              { k: 'all', label: '全部' },
              { k: 'builtin', label: '内置' },
              { k: 'user', label: '自定义' },
            ].map((opt) => (
              <Button
                key={opt.k}
                type={filter === opt.k ? 'primary' : 'default'}
                onClick={() => setFilter(opt.k)}
                size="small"
              >
                {opt.label}
              </Button>
            ))}
          </Space>
        </div>
      </div>

      <Spin spinning={loading}>
        {skills.length === 0 ? (
          <div className="fg-empty-state">
            <BookOutlined style={{ fontSize: 36, marginBottom: 12 }} />
            <div>暂无技能</div>
            <div style={{ marginTop: 12, fontSize: 13 }}>点击右上角「新建技能」开始编写你的第一个自定义技能</div>
          </div>
        ) : (
          <Row gutter={[16, 16]}>
            {skills.map((item) => (
              <Col xs={24} sm={12} md={12} lg={8} key={item.name}>
                <div className="fg-skill-card">
                  <div className="head">
                    <span className="name">{item.name}</span>
                    <SoftTag tone={item.source === 'builtin' ? 'info' : 'success'}>
                      {SOURCE_LABEL[item.source] ?? item.source}
                    </SoftTag>
                    {item.always && (
                      <SoftTag tone="warning">常驻</SoftTag>
                    )}
                  </div>
                  <div className="desc">{item.description}</div>
                  {item.tags?.length > 0 && (
                    <div className="tags">
                      {item.tags.map((t) => (
                        <SoftTag tone="default" key={t}>
                          <TagOutlined style={{ marginRight: 2 }} />
                          {t}
                        </SoftTag>
                      ))}
                    </div>
                  )}
                  <div className="actions">
                    <Button
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => handleView(item.name)}
                    >
                      查看
                    </Button>
                    {item.source === 'user' && (
                      <>
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleOpenEdit(item.name)}
                        >
                          编辑
                        </Button>
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            Modal.confirm({
                              title: `删除技能 "${item.name}"?`,
                              okText: '删除',
                              okType: 'danger',
                              cancelText: '取消',
                              onOk: () => handleDelete(item.name),
                            })
                          }}
                        >
                          删除
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      {/* View Modal */}
      <Modal
        title={<Space><EyeOutlined />{viewDetail?.name ?? '技能详情'}</Space>}
        open={viewVisible}
        onCancel={() => setViewVisible(false)}
        footer={null}
        width={720}
      >
        {viewDetail && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Space wrap>
              <SoftTag tone={viewDetail.source === 'builtin' ? 'info' : 'success'}>
                {SOURCE_LABEL[viewDetail.source]}
              </SoftTag>
              {viewDetail.always && <SoftTag tone="warning">常驻</SoftTag>}
              {viewDetail.tags?.map((t) => (
                <SoftTag tone="default" key={t}>{t}</SoftTag>
              ))}
            </Space>
            <div style={{ color: 'var(--fg-text-secondary)', fontSize: 13 }}>
              {viewDetail.description}
            </div>
            <pre className="fg-codeblock light">
              {viewDetail.body || viewDetail.content}
            </pre>
          </Space>
        )}
      </Modal>

      {/* Create/Edit Modal */}
      <Modal
        title={
          <Space>
            {editMode === 'create' ? <PlusOutlined /> : <EditOutlined />}
            {editMode === 'create' ? '新建技能' : `编辑技能: ${editName}`}
          </Space>
        }
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={handleSave}
        confirmLoading={editSaving}
        okText="保存"
        cancelText="取消"
        width={760}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ fontSize: 13, color: 'var(--fg-text-secondary)' }}>
            技能文件使用 Markdown 格式 + YAML frontmatter（<code className="fg-mono">name, description, always, tags</code>）
          </div>
          <TextArea
            rows={20}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}
            placeholder={`---\nname: my-skill\ndescription: "技能描述"\nalways: false\ntags: ["scene"]\n---\n\n# 技能内容\n\n...`}
          />
        </Space>
      </Modal>
    </div>
  )
}
