import { Badge, Tag } from 'antd'

interface Props {
  online: boolean
  size?: 'small' | 'default'
}

export default function StatusBadge({ online, size = 'default' }: Props) {
  if (size === 'small') {
    return <Badge status={online ? 'success' : 'default'} />
  }
  return (
    <Tag color={online ? 'green' : 'default'} bordered={false}>
      {online ? '在线' : '离线'}
    </Tag>
  )
}
