import { useState, useEffect, useCallback } from 'react'
import {
  Card, Select, Row, Col, Space, Typography, Spin, Empty, Tag,
  Switch, Slider, Button, Descriptions, message, Alert, Collapse, Divider,
} from 'antd'
import {
  BulbOutlined, ThunderboltOutlined, ReloadOutlined,
  HomeOutlined, AppstoreOutlined, PoweroffOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'
import StatusBadge from '../components/StatusBadge'
import {
  getXiaomiAreas, getXiaomiDeviceClasses, getXiaomiDevices,
  getXiaomiDeviceSpec, xiaomiSendCtrlRpc, xiaomiSendGetRpc,
  type XiaomiArea, type XiaomiDeviceClass, type XiaomiDevice,
  type DeviceSpec, type SpecProperty, type SpecAction,
} from '../services/mcp-client'

const { Text, Title } = Typography

function PropertyControl({
  prop, deviceId, value, onRefresh,
}: {
  prop: SpecProperty; deviceId: string; value: unknown; onRefresh: () => void
}) {
  const [loading, setLoading] = useState(false)
  const writable = prop.access.includes('write')

  const setValue = async (val: unknown) => {
    setLoading(true)
    try {
      const res = await xiaomiSendCtrlRpc(deviceId, prop.iid, val)
      if (res.success) { message.success(`${prop.name} 设置成功`); onRefresh() }
      else message.error('设置失败')
    } catch (e: unknown) {
      message.error(String(e))
    } finally { setLoading(false) }
  }

  if (prop.format === 'bool' && writable) {
    return (
      <Space>
        <Text>{prop.name}</Text>
        <Switch
          checked={value === true}
          loading={loading}
          onChange={(v) => setValue(v)}
          checkedChildren="开" unCheckedChildren="关"
        />
      </Space>
    )
  }

  const vr = prop.valueRange
  if (Array.isArray(vr) && vr.length >= 2 && typeof vr[0] === 'number' && writable) {
    const min = vr[0] as number
    const max = vr[1] as number
    const step = (vr[2] as number) || 1
    return (
      <div>
        <Space>
          <Text>{prop.name}</Text>
          <Text type="secondary">{String(value ?? '-')}</Text>
        </Space>
        <Slider
          min={min} max={max} step={step}
          value={typeof value === 'number' ? value : min}
          disabled={loading}
          onChangeComplete={(v) => setValue(v)}
          style={{ marginTop: 0 }}
        />
      </div>
    )
  }

  if (Array.isArray(vr) && vr.length > 0 && typeof vr[0] === 'object' && writable) {
    const options = (vr as Array<{ value: number; description: string }>).map((v) => ({
      label: v.description, value: v.value,
    }))
    return (
      <Space>
        <Text>{prop.name}</Text>
        <Select
          options={options}
          value={typeof value === 'number' ? value : undefined}
          loading={loading}
          onChange={(v) => setValue(v)}
          style={{ minWidth: 120 }}
        />
      </Space>
    )
  }

  return (
    <Space>
      <Text>{prop.name}</Text>
      <Tag>{String(value ?? '-')}</Tag>
      <Text type="secondary" style={{ fontSize: 12 }}>{prop.format} ({prop.access})</Text>
    </Space>
  )
}

function ActionButton({ action, deviceId }: { action: SpecAction; deviceId: string }) {
  const [loading, setLoading] = useState(false)
  const exec = async () => {
    setLoading(true)
    try {
      const res = await xiaomiSendCtrlRpc(deviceId, action.iid)
      if (res.success) message.success(`${action.name} 执行成功`)
      else message.error('执行失败')
    } catch (e: unknown) {
      message.error(String(e))
    } finally { setLoading(false) }
  }
  return (
    <Button icon={<ThunderboltOutlined />} loading={loading} onClick={exec}>
      {action.name}
    </Button>
  )
}

export default function DeviceControl() {
  const authorized = useAuthStore((s) => s.authorized)
  const serverOnline = useAuthStore((s) => s.serverOnline)

  const [areas, setAreas] = useState<XiaomiArea[]>([])
  const [classes, setClasses] = useState<XiaomiDeviceClass[]>([])
  const [devices, setDevices] = useState<XiaomiDevice[]>([])
  const [selectedArea, setSelectedArea] = useState<string>()
  const [selectedClass, setSelectedClass] = useState<string>()
  const [selectedDevice, setSelectedDevice] = useState<XiaomiDevice | null>(null)
  const [spec, setSpec] = useState<DeviceSpec | null>(null)
  const [propValues, setPropValues] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(false)
  const [specLoading, setSpecLoading] = useState(false)

  useEffect(() => {
    if (!serverOnline || !authorized) return
    Promise.all([getXiaomiAreas(), getXiaomiDeviceClasses()]).then(([a, c]) => {
      setAreas(a.areas)
      setClasses(c.device_classes)
    }).catch(() => {})
  }, [serverOnline, authorized])

  useEffect(() => {
    if (!serverOnline || !authorized) return
    setLoading(true)
    getXiaomiDevices(selectedArea, selectedClass)
      .then((r) => setDevices(r.devices))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedArea, selectedClass, serverOnline, authorized])

  const loadSpec = async (dev: XiaomiDevice) => {
    setSelectedDevice(dev)
    setSpec(null)
    setPropValues({})
    setSpecLoading(true)
    try {
      const s = await getXiaomiDeviceSpec(dev.did)
      setSpec(s)
      await refreshProps(dev.did, s)
    } catch (e: unknown) {
      message.error('获取 SPEC 失败: ' + String(e))
    } finally { setSpecLoading(false) }
  }

  const refreshProps = useCallback(async (did: string, s: DeviceSpec) => {
    const vals: Record<string, unknown> = {}
    for (const svc of s.services) {
      for (const p of svc.properties) {
        if (!p.access.includes('read')) continue
        try {
          const res = await xiaomiSendGetRpc(did, p.iid)
          const result = (res as { result?: Array<{ value?: unknown }> }).result
          if (result?.[0]?.value !== undefined) vals[p.iid] = result[0].value
        } catch { /* skip unreadable */ }
      }
    }
    setPropValues(vals)
  }, [])

  if (!serverOnline) return <Empty description="MCP 服务器未连接" />
  if (!authorized) return <Empty description="请先完成米家账号授权" />

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card size="small">
        <Row gutter={12} align="middle">
          <Col>
            <Space>
              <HomeOutlined />
              <Select
                placeholder="全部区域"
                allowClear
                style={{ width: 150 }}
                value={selectedArea}
                onChange={setSelectedArea}
                options={areas.map((a) => ({ label: `${a.name} (${a.device_count})`, value: a.area_id }))}
              />
            </Space>
          </Col>
          <Col>
            <Space>
              <AppstoreOutlined />
              <Select
                placeholder="全部类别"
                allowClear
                style={{ width: 150 }}
                value={selectedClass}
                onChange={setSelectedClass}
                options={classes.map((c) => ({ label: `${c.device_class} (${c.count})`, value: c.device_class }))}
              />
            </Space>
          </Col>
          <Col flex="auto" />
          <Col>
            <Text type="secondary">{devices.length} 台设备</Text>
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Spin spinning={loading}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {devices.length === 0 && <Empty description="无设备" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
              {devices.map((d) => (
                <Card
                  key={d.did}
                  size="small"
                  hoverable
                  onClick={() => loadSpec(d)}
                  style={{
                    borderLeft: selectedDevice?.did === d.did ? '3px solid #1677ff' : undefined,
                    cursor: 'pointer',
                  }}
                >
                  <Space>
                    <BulbOutlined />
                    <Text strong>{d.name}</Text>
                    <StatusBadge online={d.online} size="small" />
                  </Space>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{d.model}</Text>
                    <Tag style={{ marginLeft: 8 }} bordered={false}>{d.home_info}</Tag>
                  </div>
                </Card>
              ))}
            </Space>
          </Spin>
        </Col>

        <Col xs={24} md={16}>
          {!selectedDevice ? (
            <Card><Empty description="选择设备查看控制面板" /></Card>
          ) : specLoading ? (
            <Card><Spin tip="加载 SPEC..." style={{ width: '100%', padding: 40 }}><div /></Spin></Card>
          ) : spec ? (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Card size="small" title={
                <Space>
                  <PoweroffOutlined />
                  <Text strong>{selectedDevice.name}</Text>
                  <Tag color="blue">{selectedDevice.device_class}</Tag>
                  <StatusBadge online={selectedDevice.online} size="small" />
                </Space>
              } extra={
                <Button
                  icon={<ReloadOutlined />}
                  size="small"
                  onClick={() => refreshProps(selectedDevice.did, spec)}
                >
                  刷新
                </Button>
              }>
                <Descriptions size="small" column={2} bordered>
                  <Descriptions.Item label="DID">{selectedDevice.did}</Descriptions.Item>
                  <Descriptions.Item label="型号">{selectedDevice.model}</Descriptions.Item>
                  <Descriptions.Item label="SPEC" span={2}>
                    <Text copyable style={{ fontSize: 11 }}>{spec.specType}</Text>
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              {spec.services.filter((s) => s.siid > 1).map((svc) => (
                <Card key={svc.siid} size="small" title={
                  <Space>
                    <Title level={5} style={{ margin: 0 }}>
                      {svc.description}
                    </Title>
                    <Tag>siid={svc.siid}</Tag>
                  </Space>
                }>
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    {svc.properties.filter((p) => p.access.includes('read') || p.access.includes('write')).map((p) => (
                      <PropertyControl
                        key={p.iid}
                        prop={p}
                        deviceId={selectedDevice.did}
                        value={propValues[p.iid]}
                        onRefresh={() => refreshProps(selectedDevice.did, spec)}
                      />
                    ))}

                    {svc.actions.length > 0 && (
                      <>
                        <Divider style={{ margin: '8px 0' }} />
                        <Space wrap>
                          {svc.actions.map((a) => (
                            <ActionButton key={a.iid} action={a} deviceId={selectedDevice.did} />
                          ))}
                        </Space>
                      </>
                    )}
                  </Space>
                </Card>
              ))}

              <Collapse size="small" items={[{
                key: 'info',
                label: '设备信息 (siid=1)',
                children: spec.services.filter((s) => s.siid === 1).map((svc) => (
                  <Descriptions key={svc.siid} size="small" column={1} bordered>
                    {svc.properties.map((p) => (
                      <Descriptions.Item key={p.iid} label={p.name}>
                        {String(propValues[p.iid] ?? '-')}
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                )),
              }]} />
            </Space>
          ) : (
            <Card><Alert message="无法加载设备 SPEC" type="warning" /></Card>
          )}
        </Col>
      </Row>
    </Space>
  )
}
