import { useEffect, useState, useCallback } from 'react'
import {
  Card, Typography, Space, Button, Input, Tabs, List, Empty, message,
  Popconfirm, Tag, Result, Spin,
} from 'antd'
import {
  FileTextOutlined, CalendarOutlined, SearchOutlined, ReloadOutlined,
  DeleteOutlined, PlusOutlined, SaveOutlined,
} from '@ant-design/icons'
import {
  memoryRead, memoryWrite, memoryAppend, memoryList, memorySearch, memoryDelete,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

export default function Memory() {
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const [loading, setLoading] = useState(false)

  // Long-term memory
  const [longTermContent, setLongTermContent] = useState('')
  const [longTermEditing, setLongTermEditing] = useState(false)
  const [longTermDraft, setLongTermDraft] = useState('')

  // Today's note
  const [todayContent, setTodayContent] = useState('')
  const [appendText, setAppendText] = useState('')

  // Daily list
  const [dailyDates, setDailyDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dailyContent, setDailyContent] = useState('')

  // Search
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
    return <Result status="warning" title="MCP Server 离线" subTitle="请先启动 MCP Server" />
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
    <Spin spinning={loading}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space>
          <FileTextOutlined style={{ fontSize: 20 }} />
          <Title level={4} style={{ margin: 0 }}>记忆管理</Title>
          <Button icon={<ReloadOutlined />} size="small" onClick={refresh}>刷新</Button>
        </Space>

        <Tabs defaultActiveKey="longterm" items={[
          {
            key: 'longterm',
            label: '长期记忆',
            children: (
              <Card size="small">
                {longTermEditing ? (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <TextArea
                      rows={16}
                      value={longTermDraft}
                      onChange={(e) => setLongTermDraft(e.target.value)}
                      style={{ fontFamily: 'monospace', fontSize: 13 }}
                    />
                    <Space>
                      <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveLongTerm}>
                        保存
                      </Button>
                      <Button onClick={() => setLongTermEditing(false)}>取消</Button>
                    </Space>
                  </Space>
                ) : (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Button
                      size="small"
                      onClick={() => { setLongTermDraft(longTermContent); setLongTermEditing(true) }}
                    >
                      编辑
                    </Button>
                    <pre style={{
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      background: '#fafafa', padding: 12, borderRadius: 6,
                      fontSize: 13, maxHeight: 500, overflow: 'auto',
                      border: '1px solid #f0f0f0',
                    }}>
                      {longTermContent || '(空，点击编辑添加内容)'}
                    </pre>
                  </Space>
                )}
              </Card>
            ),
          },
          {
            key: 'today',
            label: '今日笔记',
            children: (
              <Card size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <pre style={{
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    background: '#fafafa', padding: 12, borderRadius: 6,
                    fontSize: 13, maxHeight: 300, overflow: 'auto',
                    border: '1px solid #f0f0f0',
                  }}>
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
            label: `历史记录 (${dailyDates.length})`,
            children: (
              <Card size="small">
                {dailyDates.length === 0 ? (
                  <Empty description="暂无历史记录" />
                ) : (
                  <div style={{ display: 'flex', gap: 16 }}>
                    <List
                      size="small"
                      style={{ width: 180, maxHeight: 500, overflow: 'auto' }}
                      dataSource={dailyDates}
                      renderItem={(date) => (
                        <List.Item
                          style={{
                            cursor: 'pointer',
                            background: selectedDate === date ? '#e6f4ff' : undefined,
                            padding: '4px 8px',
                          }}
                          onClick={() => handleViewDaily(date)}
                          actions={[
                            <Popconfirm
                              key="del"
                              title={`删除 ${date} 的笔记？`}
                              onConfirm={() => handleDeleteDaily(date)}
                            >
                              <DeleteOutlined style={{ color: '#ff4d4f' }} />
                            </Popconfirm>,
                          ]}
                        >
                          <CalendarOutlined style={{ marginRight: 6 }} />
                          <Text style={{ fontSize: 13 }}>{date}</Text>
                        </List.Item>
                      )}
                    />
                    <pre style={{
                      flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      background: '#fafafa', padding: 12, borderRadius: 6,
                      fontSize: 13, maxHeight: 500, overflow: 'auto',
                      border: '1px solid #f0f0f0',
                    }}>
                      {selectedDate ? dailyContent : '← 选择一个日期查看内容'}
                    </pre>
                  </div>
                )}
              </Card>
            ),
          },
          {
            key: 'search',
            label: '搜索',
            children: (
              <Card size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space.Compact style={{ width: '100%' }}>
                    <Input
                      placeholder="输入关键词搜索记忆..."
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      onPressEnter={handleSearch}
                      prefix={<SearchOutlined />}
                    />
                    <Button type="primary" onClick={handleSearch}>搜索</Button>
                  </Space.Compact>
                  {searchResult && (
                    <pre style={{
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      background: '#fafafa', padding: 12, borderRadius: 6,
                      fontSize: 13, maxHeight: 400, overflow: 'auto',
                      border: '1px solid #f0f0f0',
                    }}>
                      {searchResult}
                    </pre>
                  )}
                </Space>
              </Card>
            ),
          },
        ]} />
      </Space>
    </Spin>
  )
}
