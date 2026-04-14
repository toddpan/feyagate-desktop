import { useEffect, useState, useCallback } from 'react'
import {
  Card, Typography, Space, Button, Input, Tag, Empty, message, Modal,
  Spin, List, Segmented, Badge,
} from 'antd'
import {
  ShopOutlined, DownloadOutlined, SearchOutlined,
} from '@ant-design/icons'
import {
  fetchSkillStoreList, fetchSkillStoreDetail, downloadSkill,
  StoreSkill,
} from '../services/skill-store-api'
import { skillCreate } from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'

const { Title, Text, Paragraph } = Typography

const CATEGORY_LABELS: Record<string, string> = {
  '': '全部',
  home: '家居',
  automation: '自动化',
  utility: '工具',
  entertainment: '娱乐',
  security: '安防',
}

const CATEGORY_COLORS: Record<string, string> = {
  home: 'blue',
  automation: 'purple',
  utility: 'cyan',
  entertainment: 'magenta',
  security: 'red',
}

const ICON_MAP: Record<string, string> = {
  star: '⭐', lightbulb: '💡', home: '🏠', bolt: '⚡',
  shield: '🛡️', music: '🎵', camera: '📷', timer: '⏰',
}

function parseTags(tagsStr: string): string[] {
  try {
    return JSON.parse(tagsStr || '[]')
  } catch {
    return []
  }
}

export default function SkillStore() {
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const [loading, setLoading] = useState(false)
  const [skills, setSkills] = useState<StoreSkill[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')
  const [keyword, setKeyword] = useState('')

  const [detailVisible, setDetailVisible] = useState(false)
  const [detailSkill, setDetailSkill] = useState<StoreSkill | null>(null)
  const [installing, setInstalling] = useState(false)

  const loadSkills = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchSkillStoreList(page, 20, category, keyword)
      setSkills(res.skills || [])
      setTotal(res.total)
    } catch (e: unknown) {
      message.error('加载商店失败: ' + (e instanceof Error ? e.message : '网络错误'))
    }
    setLoading(false)
  }, [page, category, keyword])

  useEffect(() => {
    loadSkills()
  }, [loadSkills])

  const handleView = async (skill: StoreSkill) => {
    try {
      const detail = await fetchSkillStoreDetail(skill.id)
      setDetailSkill(detail)
      setDetailVisible(true)
    } catch (e: unknown) {
      message.error('加载详情失败: ' + (e instanceof Error ? e.message : '未知错误'))
    }
  }

  const handleInstall = async () => {
    if (!detailSkill) return
    if (!serverOnline) {
      message.warning('MCP Server 离线，无法安装')
      return
    }
    setInstalling(true)
    try {
      await downloadSkill(detailSkill.id)

      const res = await skillCreate(detailSkill.id, detailSkill.content)
      if (res.success) {
        message.success(`技能 "${detailSkill.name}" 安装成功`)
        setDetailVisible(false)
      } else {
        message.error(res.error || '安装失败')
      }
    } catch (e: unknown) {
      message.error('安装失败: ' + (e instanceof Error ? e.message : '未知错误'))
    }
    setInstalling(false)
  }

  const categoryOptions = ['', 'home', 'automation', 'utility', 'entertainment', 'security'].map(c => ({
    label: CATEGORY_LABELS[c] || c,
    value: c,
  }))

  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space>
            <ShopOutlined style={{ fontSize: 20 }} />
            <Title level={4} style={{ margin: 0 }}>技能商店</Title>
            <Tag>{total} 个技能</Tag>
          </Space>
          <Space>
            <Input
              placeholder="搜索技能..."
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1) }}
              allowClear
              style={{ width: 200 }}
            />
          </Space>
        </Space>

        <Segmented
          value={category}
          onChange={(v) => { setCategory(v as string); setPage(1) }}
          options={categoryOptions}
        />

        {skills.length === 0 ? (
          <Empty description="暂无可用技能" />
        ) : (
          <List
            grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
            dataSource={skills}
            pagination={total > 20 ? {
              current: page,
              pageSize: 20,
              total,
              onChange: (p) => setPage(p),
              showSizeChanger: false,
            } : false}
            renderItem={(item) => {
              const tags = parseTags(item.tags)
              return (
                <List.Item>
                  <Card
                    size="small"
                    hoverable
                    onClick={() => handleView(item)}
                    title={
                      <Space>
                        <span style={{ fontSize: 18 }}>{ICON_MAP[item.icon] || '🧩'}</span>
                        <Text strong>{item.name}</Text>
                        <Tag color={CATEGORY_COLORS[item.category] || 'default'}>
                          {CATEGORY_LABELS[item.category] || item.category}
                        </Tag>
                      </Space>
                    }
                    extra={
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        v{item.version}
                      </Text>
                    }
                  >
                    <Paragraph
                      ellipsis={{ rows: 2 }}
                      style={{ fontSize: 13, color: '#666', marginBottom: 8 }}
                    >
                      {item.description}
                    </Paragraph>
                    <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                      <Space wrap size={4}>
                        {tags.slice(0, 3).map((t) => (
                          <Tag key={t} style={{ fontSize: 11 }}>{t}</Tag>
                        ))}
                      </Space>
                      <Space size={12}>
                        <Badge count={item.download_count} overflowCount={9999} showZero
                          style={{ backgroundColor: '#f0f0f0', color: '#999', fontSize: 11 }} />
                        <Text type="secondary" style={{ fontSize: 11 }}>{item.author}</Text>
                      </Space>
                    </Space>
                  </Card>
                </List.Item>
              )
            }}
          />
        )}
      </Space>

      <Modal
        title={detailSkill ? detailSkill.name : '技能详情'}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        width={700}
        footer={[
          <Button key="cancel" onClick={() => setDetailVisible(false)}>关闭</Button>,
          <Button
            key="install"
            type="primary"
            icon={<DownloadOutlined />}
            loading={installing}
            onClick={handleInstall}
            disabled={!serverOnline}
          >
            安装到本地
          </Button>,
        ]}
      >
        {detailSkill && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space wrap>
              <span style={{ fontSize: 24 }}>{ICON_MAP[detailSkill.icon] || '🧩'}</span>
              <Tag color={CATEGORY_COLORS[detailSkill.category]}>
                {CATEGORY_LABELS[detailSkill.category] || detailSkill.category}
              </Tag>
              <Tag>v{detailSkill.version}</Tag>
              {detailSkill.always && <Tag color="green">常驻</Tag>}
              <Text type="secondary">{detailSkill.author} · {detailSkill.download_count} 次下载</Text>
            </Space>
            <Paragraph style={{ fontSize: 14 }}>{detailSkill.description}</Paragraph>
            {parseTags(detailSkill.tags).length > 0 && (
              <Space wrap size={4}>
                {parseTags(detailSkill.tags).map((t) => <Tag key={t}>{t}</Tag>)}
              </Space>
            )}
            <pre style={{
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              background: '#fafafa', padding: 12, borderRadius: 6,
              fontSize: 13, maxHeight: 400, overflow: 'auto',
              border: '1px solid #f0f0f0',
            }}>
              {detailSkill.content}
            </pre>
          </Space>
        )}
      </Modal>
    </Spin>
  )
}
