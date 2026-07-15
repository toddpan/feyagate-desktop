import { useEffect, useState, useCallback } from 'react'
import {
  Card, Button, Input, Tabs, Empty, message,
  Popconfirm, Spin, Row, Col, Space,
} from 'antd'
import {
  FileTextOutlined, CalendarOutlined, SearchOutlined, ReloadOutlined,
  DeleteOutlined, PlusOutlined, SaveOutlined,
  EditOutlined, BulbOutlined,
} from '@ant-design/icons'
import {
  memoryRead, memoryWrite, memoryAppend, memoryList, memorySearch, memoryDelete,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'
import { PageHeader, SoftTag } from '../components/ui'

const { TextArea } = Input

export default function Memory() {
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const [loading, setLoading] = useState(false)

  const [longTermContent, setLongTermContent] = useState('')
  const [longTermEditing, setLongTermEditing] = useState(false)
  const [longTermDraft, setLongTermDraft] = useState('')

  const [todayContent, setTodayContent] = useState('')
  const [appendText, setAppendText] = useState('')

  const [dailyDates, setDailyDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dailyContent, setDailyContent] = useState('')

  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResult, setSearchResult] = useState('')

  const loadLongTerm = useCallback(async () => {
    try {
      const res = await memoryRead('long_term')
      setLongTermContent(res.content || '')
    } catch { /* ignore */ }
  }, [])

  const loadToday = useCallback(async () => {
    try {
      const res = await memoryRead('today')
      setTodayContent(res.content || '')
    } catch { /* ignore */ }
  }, [])

  const loadDailyList = useCallback(async () => {
    try {
      const res = await memoryList(90)
      setDailyDates(res.dates || [])
    } catch { /* ignore */ }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadLongTerm(), loadToday(), loadDailyList()])
    setLoading(false)
  }, [loadLongTerm, loadToday, loadDailyList])

  useEffect(() => {
    if (serverOnline) refresh()
  }, [serverOnline, refresh])

  if (!serverOnline) {
    return (
      <div className="fg-page">
        <PageHeader
          icon={<FileTextOutlined />}
          title="记忆"
          subtitle="AI 的长期记忆与日常笔记"
        />
        <div className="fg-empty-state">MCP Server 离线</div>
      </div>
    )
  }

  const handleSaveLongTerm = async () => {
    try {
      await memoryWrite(longTermDraft)
      setLongTermContent(longTermDraft)
      setLongTermEditing(false)
      message.success('长期记忆已保存')
    } catch (e: unknown) {
      message.error('保存失败: ' + (e instanceof Error ? e.message : '未知错误'))
    }
  }

  const handleAppendToday = async () => {
    if (!appendText.trim()) return
    try {
      await memoryAppend(appendText.trim(), 'today')
      setAppendText('')
      loadToday()
      message.success('已追加到今日笔记')
    } catch (e: unknown) {
      message.error('追加失败: ' + (e instanceof Error ? e.message : '未知错误'))
    }
  }

  const handleViewDaily = async (date: string) => {
    setSelectedDate(date)
    try {
      const res = await memoryRead('daily', date)
      setDailyContent(res.content || '(空)')
    } catch {
      setDailyContent('读取失败')
    }
  }

  const handleDeleteDaily = async (date: string) => {
    try {
      await memoryDelete(date)
      setDailyDates((d) => d.filter((x) => x !== date))
      if (selectedDate === date) { setSelectedDate(null); setDailyContent('') }
      message.success(`已删除 ${date} 的笔记`)
    } catch (e: unknown) {
      message.error('删除失败: ' + (e instanceof Error ? e.message : '未知错误'))
    }
  }

  const handleSearch = async () => {
    if (!searchKeyword.trim()) return
    try {
      const res = await memorySearch(searchKeyword.trim())
      setSearchResult(res.matches || res.message || '未找到匹配内容')
    } catch (e: unknown) {
      setSearchResult('搜索失败: ' + (e instanceof Error ? e.message : '未知错误'))
    }
  }

  return (
    <div className="fg-page">
      <PageHeader
        icon={<FileTextOutlined />}
        title="记忆"
        subtitle="管理 AI 的长期知识沉淀和每日笔记"
        extra={
          <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
            刷新
          </Button>
        }
      />

      <Spin spinning={loading}>
        <Tabs
          defaultActiveKey="longterm"
          items={[
            {
              key: 'longterm',
              label: (
                <span>
                  <BulbOutlined /> 长期记忆
                </span>
              ),
              children: (
                <Card className="fg-card-antd">
                  {longTermEditing ? (
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                      <TextArea
                        rows={16}
                        value={longTermDraft}
                        onChange={(e) => setLongTermDraft(e.target.value)}
                        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}
                      />
                      <Space>
                        <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveLongTerm}>
                          保存
                        </Button>
                        <Button onClick={() => setLongTermEditing(false)}>取消</Button>
                      </Space>
                    </Space>
                  ) : (
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                      <Space>
                        <Button
                          icon={<EditOutlined />}
                          onClick={() => {
                            setLongTermDraft(longTermContent)
                            setLongTermEditing(true)
                          }}
                        >
                          编辑
                        </Button>
                        <SoftTag tone="default">{longTermContent.length} 字</SoftTag>
                      </Space>
                      <pre className="fg-codeblock light">
                        {longTermContent || '(空，点击编辑添加内容)'}
                      </pre>
                    </Space>
                  )}
                </Card>
              ),
            },
            {
              key: 'today',
              label: (
                <span>
                  <CalendarOutlined /> 今日笔记
                </span>
              ),
              children: (
                <Card className="fg-card-antd">
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <pre className="fg-codeblock light" style={{ maxHeight: 360 }}>
                      {todayContent || '(今天还没有笔记)'}
                    </pre>
                    <Space.Compact style={{ width: '100%' }}>
                      <Input
                        placeholder="追加一条笔记..."
                        value={appendText}
                        onChange={(e) => setAppendText(e.target.value)}
                        onPressEnter={handleAppendToday}
                      />
                      <Button type="primary" icon={<PlusOutlined />} onClick={handleAppendToday}>
                        追加
                      </Button>
                    </Space.Compact>
                  </Space>
                </Card>
              ),
            },
            {
              key: 'history',
              label: <span><CalendarOutlined /> 历史记录 ({dailyDates.length})</span>,
              children: (
                <div className="fg-memo-shell">
                  <div className="dates">
                    {dailyDates.length === 0 ? (
                      <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-text-tertiary)' }}>
                        暂无历史记录
                      </div>
                    ) : (
                      dailyDates.map((date) => (
                        <div
                          key={date}
                          className={`item ${selectedDate === date ? 'active' : ''}`}
                          onClick={() => handleViewDaily(date)}
                        >
                          <CalendarOutlined />
                          <span>{date}</span>
                          <div className="actions">
                            <Popconfirm
                              title={`删除 ${date} 的笔记?`}
                              onConfirm={(e) => { e?.stopPropagation(); handleDeleteDaily(date) }}
                              onCancel={(e) => e?.stopPropagation()}
                            >
                              <DeleteOutlined
                                style={{ color: 'var(--fg-text-tertiary)' }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </Popconfirm>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="content">
                    {selectedDate ? (
                      <pre className="fg-codeblock light" style={{ minHeight: 360, maxHeight: 'unset' }}>
                        {dailyContent}
                      </pre>
                    ) : (
                      <Empty
                        description={dailyDates.length === 0 ? '还没有历史笔记' : '选择一个日期查看内容'}
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        style={{ marginTop: 80 }}
                      />
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'search',
              label: <span><SearchOutlined /> 搜索</span>,
              children: (
                <Card className="fg-card-antd">
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <Space.Compact style={{ width: '100%' }}>
                      <Input
                        placeholder="输入关键词搜索记忆..."
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        onPressEnter={handleSearch}
                        prefix={<SearchOutlined />}
                        size="large"
                      />
                      <Button type="primary" size="large" onClick={handleSearch}>
                        搜索
                      </Button>
                    </Space.Compact>
                    {searchResult ? (
                      <pre className="fg-codeblock light" style={{ maxHeight: 480 }}>
                        {searchResult}
                      </pre>
                    ) : (
                      <Empty description="输入关键词开始搜索" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    )}
                  </Space>
                </Card>
              ),
            },
          ]}
        />
      </Spin>
    </div>
  )
}
