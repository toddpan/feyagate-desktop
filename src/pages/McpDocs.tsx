import { useState } from 'react'
import {
  Card,
  Typography,
  Space,
  Tabs,
  Tag,
  Table,
  Alert,
  Collapse,
  Button,
  message,
  Descriptions,
  Divider,
} from 'antd'
import {
  ApiOutlined,
  CopyOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
  VideoCameraOutlined,
  AppstoreOutlined,
  LinkOutlined,
  CodeOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'

const { Title, Text, Paragraph } = Typography

const SERVER_URL = 'http://localhost:8080'

function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
  const copy = () => {
    navigator.clipboard.writeText(code)
    message.success('已复制')
  }
  return (
    <div style={{ position: 'relative' }}>
      <Button
        icon={<CopyOutlined />}
        size="small"
        type="text"
        style={{ position: 'absolute', top: 4, right: 4, zIndex: 1 }}
        onClick={copy}
      />
      <pre style={{
        background: '#f6f8fa',
        padding: '12px 16px',
        borderRadius: 8,
        overflow: 'auto',
        fontSize: 13,
        lineHeight: 1.5,
        maxHeight: 400,
      }}>
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  )
}

interface ToolDoc {
  name: string
  description: string
  icon: React.ReactNode
  category: 'auth' | 'device' | 'camera'
  params: Array<{ name: string; type: string; required: boolean; desc: string }>
  example: { request: string; response: string }
}

const tools: ToolDoc[] = [
  {
    name: 'auth/status',
    description: '查询小米 OAuth 授权状态，包括是否已授权、云服务器区域、Token 剩余有效时间。',
    icon: <SafetyCertificateOutlined />,
    category: 'auth',
    params: [],
    example: {
      request: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'tools/call',
        params: { name: 'auth/status', arguments: {} },
      }, null, 2),
      response: JSON.stringify({
        authorized: true,
        cloud_server: 'cn',
        remaining_seconds: 168000,
      }, null, 2),
    },
  },
  {
    name: 'auth/url',
    description: '获取小米 OAuth 授权 URL。用户需要在浏览器中打开此 URL 完成登录。登录后浏览器会重定向到 https://127.0.0.1/?code=xxx。',
    icon: <LinkOutlined />,
    category: 'auth',
    params: [],
    example: {
      request: JSON.stringify({
        jsonrpc: '2.0', id: 2,
        method: 'tools/call',
        params: { name: 'auth/url', arguments: {} },
      }, null, 2),
      response: JSON.stringify({
        url: 'https://account.xiaomi.com/oauth2/authorize?client_id=...&redirect_uri=https://127.0.0.1&...',
      }, null, 2),
    },
  },
  {
    name: 'auth/callback',
    description: '处理 OAuth 回调授权码。用户在浏览器完成授权后，从重定向 URL 中提取 code 参数并提交。',
    icon: <SafetyCertificateOutlined />,
    category: 'auth',
    params: [
      { name: 'code', type: 'string', required: true, desc: 'OAuth 授权码（从 redirect URL 中提取）' },
    ],
    example: {
      request: JSON.stringify({
        jsonrpc: '2.0', id: 3,
        method: 'tools/call',
        params: { name: 'auth/callback', arguments: { code: 'abc123def456' } },
      }, null, 2),
      response: JSON.stringify({ success: true }, null, 2),
    },
  },
  {
    name: 'device/list',
    description: '列出所有小米智能设备，包括设备 ID、名称、型号、房间和在线状态。可选关键词过滤。',
    icon: <AppstoreOutlined />,
    category: 'device',
    params: [
      { name: 'filter', type: 'string[]', required: false, desc: '可选关键词过滤（按名称、型号、房间搜索）' },
    ],
    example: {
      request: JSON.stringify({
        jsonrpc: '2.0', id: 4,
        method: 'tools/call',
        params: { name: 'device/list', arguments: {} },
      }, null, 2),
      response: JSON.stringify({
        count: 34,
        devices: [
          { did: '123456789', name: '客厅灯', model: 'yeelink.light.strip6', home: '我的家', room: '客厅', online: true },
          { did: '987654321', name: '卧室摄像头', model: 'chuangmi.camera.ipc019', home: '我的家', room: '卧室', online: true },
        ],
      }, null, 2),
    },
  },
  {
    name: 'device/refresh',
    description: '从小米云端强制刷新设备列表。在米家 APP 中添加或删除设备后调用此接口。',
    icon: <AppstoreOutlined />,
    category: 'device',
    params: [],
    example: {
      request: JSON.stringify({
        jsonrpc: '2.0', id: 5,
        method: 'tools/call',
        params: { name: 'device/refresh', arguments: {} },
      }, null, 2),
      response: JSON.stringify({
        success: true,
        device_count: 34,
        camera_count: 1,
      }, null, 2),
    },
  },
  {
    name: 'camera/list',
    description: '列出所有发现的小米摄像头，包括设备 ID、名称、型号、房间、在线状态和通道数。',
    icon: <VideoCameraOutlined />,
    category: 'camera',
    params: [
      { name: 'filter', type: 'string[]', required: false, desc: '可选关键词过滤' },
    ],
    example: {
      request: JSON.stringify({
        jsonrpc: '2.0', id: 6,
        method: 'tools/call',
        params: { name: 'camera/list', arguments: {} },
      }, null, 2),
      response: JSON.stringify({
        count: 1,
        cameras: [
          { did: '987654321', name: '卧室摄像头', model: 'chuangmi.camera.ipc019', home: '我的家', room: '卧室', online: true, channel_count: 1, camera_status: 'idle' },
        ],
      }, null, 2),
    },
  },
  {
    name: 'camera/connect',
    description: '连接到小米摄像头并开始接收视频流。帧会被解码为 JPEG 并缓存。需先用 camera/list 获取 camera_id。',
    icon: <VideoCameraOutlined />,
    category: 'camera',
    params: [
      { name: 'camera_id', type: 'string', required: true, desc: '摄像头设备 ID' },
    ],
    example: {
      request: JSON.stringify({
        jsonrpc: '2.0', id: 7,
        method: 'tools/call',
        params: { name: 'camera/connect', arguments: { camera_id: '987654321' } },
      }, null, 2),
      response: JSON.stringify({ status: 'connecting', camera_id: '987654321' }, null, 2),
    },
  },
  {
    name: 'camera/disconnect',
    description: '停止视频流并断开与摄像头的连接。',
    icon: <VideoCameraOutlined />,
    category: 'camera',
    params: [
      { name: 'camera_id', type: 'string', required: true, desc: '摄像头设备 ID' },
    ],
    example: {
      request: JSON.stringify({
        jsonrpc: '2.0', id: 8,
        method: 'tools/call',
        params: { name: 'camera/disconnect', arguments: { camera_id: '987654321' } },
      }, null, 2),
      response: JSON.stringify({ status: 'disconnected', camera_id: '987654321' }, null, 2),
    },
  },
  {
    name: 'camera/status',
    description: '获取摄像头的流连接状态。显示是否连接并在活跃传输，以及缓存的可用帧数。',
    icon: <VideoCameraOutlined />,
    category: 'camera',
    params: [
      { name: 'camera_id', type: 'string', required: false, desc: '摄像头设备 ID（省略则查询所有已连接摄像头）' },
    ],
    example: {
      request: JSON.stringify({
        jsonrpc: '2.0', id: 9,
        method: 'tools/call',
        params: { name: 'camera/status', arguments: { camera_id: '987654321' } },
      }, null, 2),
      response: JSON.stringify({
        connected_count: 1,
        cameras: [
          { did: '987654321', status: 'streaming', buffered_frames: 5, channel: 0 },
        ],
      }, null, 2),
    },
  },
  {
    name: 'camera/snapshot',
    description: '获取已连接摄像头的最新 JPEG 帧。返回 base64 编码的图片数据。需先调用 camera/connect。',
    icon: <VideoCameraOutlined />,
    category: 'camera',
    params: [
      { name: 'camera_id', type: 'string', required: true, desc: '摄像头设备 ID' },
      { name: 'count', type: 'number', required: false, desc: '获取帧数（默认 1）' },
      { name: 'channel', type: 'number', required: false, desc: '视频通道（默认 0）' },
    ],
    example: {
      request: JSON.stringify({
        jsonrpc: '2.0', id: 10,
        method: 'tools/call',
        params: { name: 'camera/snapshot', arguments: { camera_id: '987654321', count: 1 } },
      }, null, 2),
      response: `{
  "content": [
    {
      "type": "image",
      "data": "/9j/4AAQSkZJRg...(base64 JPEG)...",
      "mimeType": "image/jpeg"
    }
  ]
}`,
    },
  },
]

const paramColumns = [
  { title: '参数', dataIndex: 'name', key: 'name', render: (v: string) => <Text code>{v}</Text> },
  { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag>{v}</Tag> },
  { title: '必填', dataIndex: 'required', key: 'required', render: (v: boolean) => v ? <Tag color="red">是</Tag> : <Tag>否</Tag> },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
]

function ToolCard({ tool }: { tool: ToolDoc }) {
  return (
    <Card
      size="small"
      title={
        <Space>
          {tool.icon}
          <Text code style={{ fontSize: 14 }}>{tool.name}</Text>
          <Tag color={tool.category === 'auth' ? 'green' : tool.category === 'device' ? 'blue' : 'purple'}>
            {tool.category}
          </Tag>
        </Space>
      }
    >
      <Paragraph>{tool.description}</Paragraph>

      {tool.params.length > 0 && (
        <>
          <Text strong>参数：</Text>
          <Table
            dataSource={tool.params}
            columns={paramColumns}
            pagination={false}
            size="small"
            rowKey="name"
            style={{ marginTop: 8, marginBottom: 12 }}
          />
        </>
      )}

      <Collapse
        size="small"
        items={[
          {
            key: 'example',
            label: '请求 / 响应示例',
            children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text type="secondary">请求 (POST {SERVER_URL}/mcp/http)：</Text>
                  <CodeBlock code={tool.example.request} />
                </div>
                <div>
                  <Text type="secondary">响应 (content[0].text)：</Text>
                  <CodeBlock code={tool.example.response} />
                </div>
              </Space>
            ),
          },
        ]}
      />
    </Card>
  )
}

export default function McpDocs() {
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const [activeTab, setActiveTab] = useState('protocol')

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card>
        <Space align="center">
          <ApiOutlined style={{ fontSize: 28, color: '#1677ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>MCP 接口文档</Title>
            <Text type="secondary">Model Context Protocol · JSON-RPC 2.0 · {tools.length} 个工具</Text>
          </div>
        </Space>
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'protocol',
            label: <><ThunderboltOutlined /> 协议说明</>,
            children: <ProtocolTab serverOnline={serverOnline} />,
          },
          {
            key: 'tools',
            label: <><CodeOutlined /> 工具接口 ({tools.length})</>,
            children: <ToolsTab />,
          },
          {
            key: 'integration',
            label: <><LinkOutlined /> 集成指南</>,
            children: <IntegrationTab />,
          },
        ]}
      />
    </Space>
  )
}

function ProtocolTab({ serverOnline }: { serverOnline: boolean }) {
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type={serverOnline ? 'success' : 'warning'}
        showIcon
        message={serverOnline ? 'MCP Server 在线' : 'MCP Server 离线'}
        description={serverOnline ? `端点: ${SERVER_URL}/mcp/http` : '请先启动 miloco-mcp-server'}
      />

      <Card title="协议概览" size="small">
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="协议">MCP (Model Context Protocol)</Descriptions.Item>
          <Descriptions.Item label="传输层">JSON-RPC 2.0 over HTTP</Descriptions.Item>
          <Descriptions.Item label="端点"><Text code>POST {SERVER_URL}/mcp/http</Text></Descriptions.Item>
          <Descriptions.Item label="健康检查"><Text code>GET {SERVER_URL}/health</Text></Descriptions.Item>
          <Descriptions.Item label="Content-Type"><Text code>application/json</Text></Descriptions.Item>
          <Descriptions.Item label="工具数量">{tools.length} 个</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="请求格式" size="small">
        <Paragraph>所有工具调用使用统一的 JSON-RPC 2.0 格式：</Paragraph>
        <CodeBlock code={`POST ${SERVER_URL}/mcp/http
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "工具名称",
    "arguments": {
      "参数名": "参数值"
    }
  }
}`} language="http" />
      </Card>

      <Card title="响应格式" size="small">
        <Paragraph>工具返回的数据在 <Text code>result.content</Text> 数组中，支持 text 和 image 两种类型：</Paragraph>
        <CodeBlock code={`{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\\"key\\": \\"value\\"}"
      }
    ]
  }
}`} />
        <Divider style={{ margin: '12px 0' }} />
        <Paragraph>图片数据以 base64 编码返回（camera/snapshot）：</Paragraph>
        <CodeBlock code={`{
  "content": [
    {
      "type": "image",
      "data": "/9j/4AAQSkZJRg...",
      "mimeType": "image/jpeg"
    }
  ]
}`} />
      </Card>

      <Card title="快速测试 (curl)" size="small">
        <Paragraph>健康检查：</Paragraph>
        <CodeBlock code={`curl ${SERVER_URL}/health`} language="bash" />
        <Paragraph style={{ marginTop: 12 }}>查询授权状态：</Paragraph>
        <CodeBlock code={`curl -X POST ${SERVER_URL}/mcp/http \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"auth/status","arguments":{}}}'`} language="bash" />
        <Paragraph style={{ marginTop: 12 }}>获取设备列表：</Paragraph>
        <CodeBlock code={`curl -X POST ${SERVER_URL}/mcp/http \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"device/list","arguments":{}}}'`} language="bash" />
      </Card>
    </Space>
  )
}

function ToolsTab() {
  const [category, setCategory] = useState<string>('all')
  const filtered = category === 'all' ? tools : tools.filter((t) => t.category === category)

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space wrap>
        <Tag.CheckableTag checked={category === 'all'} onChange={() => setCategory('all')}>全部 ({tools.length})</Tag.CheckableTag>
        <Tag.CheckableTag checked={category === 'auth'} onChange={() => setCategory('auth')}>授权 (3)</Tag.CheckableTag>
        <Tag.CheckableTag checked={category === 'device'} onChange={() => setCategory('device')}>设备 (2)</Tag.CheckableTag>
        <Tag.CheckableTag checked={category === 'camera'} onChange={() => setCategory('camera')}>摄像头 (5)</Tag.CheckableTag>
      </Space>
      {filtered.map((tool) => (
        <ToolCard key={tool.name} tool={tool} />
      ))}
    </Space>
  )
}

function IntegrationTab() {
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card title="Claude Desktop 集成" size="small">
        <Paragraph>
          在 Claude Desktop 的 <Text code>claude_desktop_config.json</Text> 中添加以下配置，
          即可让 Claude 直接调用摄像头和设备管理功能：
        </Paragraph>
        <CodeBlock code={`{
  "mcpServers": {
    "feyagate": {
      "url": "${SERVER_URL}/mcp/http"
    }
  }
}`} />
        <Paragraph type="secondary" style={{ marginTop: 8 }}>
          配置文件路径：
          <br />macOS: <Text code>~/Library/Application Support/Claude/claude_desktop_config.json</Text>
          <br />Windows: <Text code>%APPDATA%\\Claude\\claude_desktop_config.json</Text>
        </Paragraph>
      </Card>

      <Card title="OpenClaw / 其他 MCP 客户端" size="small">
        <Paragraph>
          任何支持 MCP 协议的客户端（如 OpenClaw、Cursor、Cline 等）都可以通过 HTTP 端点连接：
        </Paragraph>
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="服务器类型">HTTP (Streamable HTTP)</Descriptions.Item>
          <Descriptions.Item label="端点地址"><Text code copyable>{SERVER_URL}/mcp/http</Text></Descriptions.Item>
          <Descriptions.Item label="传输方式">POST JSON-RPC 2.0</Descriptions.Item>
          <Descriptions.Item label="认证">无需认证（本地服务）</Descriptions.Item>
        </Descriptions>

        <Divider style={{ margin: '12px 0' }} />
        <Paragraph strong>Cursor IDE 集成（.cursor/mcp.json）：</Paragraph>
        <CodeBlock code={`{
  "mcpServers": {
    "feyagate": {
      "url": "${SERVER_URL}/mcp/http"
    }
  }
}`} />

        <Divider style={{ margin: '12px 0' }} />
        <Paragraph strong>Cline 插件集成：</Paragraph>
        <CodeBlock code={`{
  "mcpServers": {
    "feyagate": {
      "url": "${SERVER_URL}/mcp/http",
      "disabled": false
    }
  }
}`} />
      </Card>

      <Card title="典型使用流程" size="small">
        <Paragraph>
          以下是通过 MCP 接口管理摄像头的完整流程：
        </Paragraph>
        <CodeBlock code={`# 1. 检查授权状态
auth/status → 确认 authorized=true

# 2. 获取设备列表
device/list → 找到所有设备和摄像头

# 3. 列出摄像头
camera/list → 获取 camera_id

# 4. 连接摄像头
camera/connect(camera_id="xxx") → 开始视频流

# 5. 等待几秒让缓冲区填充帧
camera/status(camera_id="xxx") → 确认 buffered_frames > 0

# 6. 获取快照
camera/snapshot(camera_id="xxx", count=1) → 返回 JPEG base64 图片

# 7. 断开连接
camera/disconnect(camera_id="xxx") → 停止流并释放资源`} language="bash" />
      </Card>

      <Card title="注意事项" size="small">
        <Alert
          type="info"
          showIcon
          message="安全提示"
          description="MCP Server 默认绑定到 127.0.0.1，仅接受本机连接。如需远程访问，请修改 config.yaml 中的 bind_address。"
          style={{ marginBottom: 12 }}
        />
        <Alert
          type="warning"
          showIcon
          message="摄像头限制"
          description="同时连接的摄像头数量受网络带宽和设备性能限制。建议不要同时连接超过 3 个摄像头。使用完毕后请调用 camera/disconnect 释放资源。"
        />
      </Card>
    </Space>
  )
}
