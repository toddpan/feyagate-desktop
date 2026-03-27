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

const SERVER_URL = 'http://localhost:38080'

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
  category: 'auth' | 'device' | 'camera' | 'xiaomi'
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
  // ── 米家设备控制工具 ──────────────────────────────────────────
  {
    name: 'xiaomi/get_area_info',
    description: '获取小米智能家居的房间/区域列表。返回 area_id 和名称，供 xiaomi/get_devices 过滤使用。',
    icon: <AppstoreOutlined />,
    category: 'xiaomi',
    params: [],
    example: {
      request: JSON.stringify({ jsonrpc: '2.0', id: 11, method: 'tools/call', params: { name: 'xiaomi/get_area_info', arguments: {} } }, null, 2),
      response: JSON.stringify({ areas: [{ area_id: '客厅', name: '客厅', device_count: 20 }, { area_id: '卧室', name: '卧室', device_count: 5 }], total_areas: 2 }, null, 2),
    },
  },
  {
    name: 'xiaomi/get_device_classes',
    description: '获取当前已导入的小米设备类别列表（如 light、plug、sensor_ht 等）。供 xiaomi/get_devices 按类别过滤。',
    icon: <AppstoreOutlined />,
    category: 'xiaomi',
    params: [],
    example: {
      request: JSON.stringify({ jsonrpc: '2.0', id: 12, method: 'tools/call', params: { name: 'xiaomi/get_device_classes', arguments: {} } }, null, 2),
      response: JSON.stringify({ device_classes: [{ device_class: 'light', count: 7 }, { device_class: 'plug', count: 2 }], total_classes: 2 }, null, 2),
    },
  },
  {
    name: 'xiaomi/get_devices',
    description: '获取小米设备列表，支持按区域 area_id 和设备类别 device_class 过滤。返回 did、名称、在线状态等。',
    icon: <AppstoreOutlined />,
    category: 'xiaomi',
    params: [
      { name: 'area_id', type: 'string', required: false, desc: '区域ID，从 get_area_info 获取' },
      { name: 'device_class', type: 'string', required: false, desc: '设备类别，从 get_device_classes 获取' },
    ],
    example: {
      request: JSON.stringify({ jsonrpc: '2.0', id: 13, method: 'tools/call', params: { name: 'xiaomi/get_devices', arguments: { area_id: '客厅', device_class: 'light' } } }, null, 2),
      response: JSON.stringify({ devices: [{ did: '534345813', name: '客厅台灯', online: true, home_info: '客厅', device_class: 'light', model: 'yeelink.light.lamp2' }], count: 1 }, null, 2),
    },
  },
  {
    name: 'xiaomi/get_device_spec',
    description: '获取设备的 MIOT SPEC 功能定义（服务、属性、动作），返回轻量化格式。每个属性/动作包含 iid 标识符。',
    icon: <AppstoreOutlined />,
    category: 'xiaomi',
    params: [
      { name: 'device_id', type: 'string', required: true, desc: '小米设备ID (did)' },
    ],
    example: {
      request: JSON.stringify({ jsonrpc: '2.0', id: 14, method: 'tools/call', params: { name: 'xiaomi/get_device_spec', arguments: { device_id: '534345813' } } }, null, 2),
      response: JSON.stringify({ specType: 'urn:miot-spec-v2:device:light:...', services: [{ siid: 2, description: 'Light', properties: [{ iid: 'prop.device.2.1', name: 'Switch', format: 'bool', access: 'read,write' }], actions: [{ iid: 'action.device.2.1', name: 'Toggle', in: [] }] }] }, null, 2),
    },
  },
  {
    name: 'xiaomi/send_ctrl_rpc',
    description: '统一控制小米设备。iid 格式: prop.device.siid.piid (属性) 或 action.device.siid.aiid (动作)。',
    icon: <ThunderboltOutlined />,
    category: 'xiaomi',
    params: [
      { name: 'device_id', type: 'string', required: true, desc: '设备ID' },
      { name: 'iid', type: 'string', required: true, desc: 'SPEC 实例 ID，如 prop.device.2.1' },
      { name: 'value', type: 'any', required: false, desc: '属性值或动作参数数组' },
    ],
    example: {
      request: JSON.stringify({ jsonrpc: '2.0', id: 15, method: 'tools/call', params: { name: 'xiaomi/send_ctrl_rpc', arguments: { device_id: '534345813', iid: 'prop.device.2.1', value: true } } }, null, 2),
      response: JSON.stringify({ success: true, data: { code: 0, message: 'ok' } }, null, 2),
    },
  },
  {
    name: 'xiaomi/send_get_rpc',
    description: '查询小米设备的单个属性当前值。仅支持 prop 类型 iid。',
    icon: <ThunderboltOutlined />,
    category: 'xiaomi',
    params: [
      { name: 'device_id', type: 'string', required: true, desc: '设备ID' },
      { name: 'iid', type: 'string', required: true, desc: 'SPEC 属性实例 ID，如 prop.device.2.1' },
    ],
    example: {
      request: JSON.stringify({ jsonrpc: '2.0', id: 16, method: 'tools/call', params: { name: 'xiaomi/send_get_rpc', arguments: { device_id: '534345813', iid: 'prop.device.2.1' } } }, null, 2),
      response: JSON.stringify({ code: 0, result: [{ did: '534345813', siid: 2, piid: 1, value: true, code: 0 }] }, null, 2),
    },
  },
  {
    name: 'xiaomi/scene_list',
    description: '获取小米手动场景列表，返回 sceneId 和场景名称。',
    icon: <ThunderboltOutlined />,
    category: 'xiaomi',
    params: [],
    example: {
      request: JSON.stringify({ jsonrpc: '2.0', id: 17, method: 'tools/call', params: { name: 'xiaomi/scene_list', arguments: {} } }, null, 2),
      response: JSON.stringify({ result: [{ scene_id: '123', name: '回家模式' }] }, null, 2),
    },
  },
  {
    name: 'xiaomi/scene_trigger',
    description: '触发执行小米手动场景。需先通过 xiaomi/scene_list 获取 sceneId。',
    icon: <ThunderboltOutlined />,
    category: 'xiaomi',
    params: [
      { name: 'sceneId', type: 'string', required: true, desc: '场景ID' },
    ],
    example: {
      request: JSON.stringify({ jsonrpc: '2.0', id: 18, method: 'tools/call', params: { name: 'xiaomi/scene_trigger', arguments: { sceneId: '123' } } }, null, 2),
      response: JSON.stringify({ code: 0, message: 'ok' }, null, 2),
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
          <Tag color={tool.category === 'auth' ? 'green' : tool.category === 'device' ? 'blue' : tool.category === 'xiaomi' ? 'orange' : 'purple'}>
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
            <Text type="secondary">飞阳网关 MCP Server · JSON-RPC 2.0 · {tools.length} 个工具 · 让 AI 大模型成为你的智能家居管家</Text>
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
        <Tag.CheckableTag checked={category === 'auth'} onChange={() => setCategory('auth')}>授权 ({tools.filter(t => t.category === 'auth').length})</Tag.CheckableTag>
        <Tag.CheckableTag checked={category === 'device'} onChange={() => setCategory('device')}>设备 ({tools.filter(t => t.category === 'device').length})</Tag.CheckableTag>
        <Tag.CheckableTag checked={category === 'xiaomi'} onChange={() => setCategory('xiaomi')}>米家控制 ({tools.filter(t => t.category === 'xiaomi').length})</Tag.CheckableTag>
        <Tag.CheckableTag checked={category === 'camera'} onChange={() => setCategory('camera')}>摄像头 ({tools.filter(t => t.category === 'camera').length})</Tag.CheckableTag>
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

      <Card title="OpenClaw / 扣子 / Coze / 其他 MCP 客户端" size="small">
        <Paragraph>
          FeyaGate 已接入小智智能体、扣子空间、Coze 智能体、OpenClaw 等平台。
          任何支持 MCP 协议的客户端都可以通过 HTTP 端点连接，让 AI 大模型直接控制你的智能家居设备：
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

      <Card title="设备控制流程" size="small">
        <Paragraph>
          以下是通过 MCP 接口控制米家设备的完整流程（以控制灯为例）：
        </Paragraph>
        <CodeBlock code={`# 1. 检查授权
auth/status → 确认 authorized=true

# 2. 查看区域和设备类别
xiaomi/get_area_info → 获取房间列表
xiaomi/get_device_classes → 获取设备类别

# 3. 按区域+类别筛选设备
xiaomi/get_devices(area_id="客厅", device_class="light") → 获取 did

# 4. 获取设备 SPEC（属性和动作定义）
xiaomi/get_device_spec(device_id="534345813") → 获取 iid 列表

# 5. 读取属性
xiaomi/send_get_rpc(device_id="534345813", iid="prop.device.2.1") → 开关状态

# 6. 控制设备
xiaomi/send_ctrl_rpc(device_id="534345813", iid="prop.device.2.1", value=true)  → 开灯
xiaomi/send_ctrl_rpc(device_id="534345813", iid="prop.device.2.2", value=70)    → 亮度70%
xiaomi/send_ctrl_rpc(device_id="534345813", iid="action.device.2.1")            → Toggle`} language="bash" />
      </Card>

      <Card title="摄像头使用流程" size="small">
        <Paragraph>
          以下是通过 MCP 接口管理摄像头的完整流程：
        </Paragraph>
        <CodeBlock code={`# 1. 列出摄像头
camera/list → 获取 camera_id

# 2. 连接摄像头
camera/connect(camera_id="xxx") → 开始视频流

# 3. 等待几秒让缓冲区填充帧
camera/status(camera_id="xxx") → 确认 buffered_frames > 0

# 4. 获取快照
camera/snapshot(camera_id="xxx", count=1) → 返回 JPEG base64 图片

# 5. 断开连接
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
