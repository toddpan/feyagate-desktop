import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import UpdateNotification from './components/UpdateNotification'
import Auth from './pages/Auth'
import Devices from './pages/Devices'
import Cameras from './pages/Cameras'
import DeviceControl from './pages/DeviceControl'
import XiaozhiSettings from './pages/XiaozhiSettings'
import LicenseSettings from './pages/LicenseSettings'
import WeChatLogin from './pages/WeChatLogin'
import McpDocs from './pages/McpDocs'
import VisionSettings from './pages/VisionSettings'
import TriggerRules from './pages/TriggerRules'
import TriggerLogs from './pages/TriggerLogs'
import Dashboard from './pages/Dashboard'
import TokenStats from './pages/TokenStats'
import TriggerStats from './pages/TriggerStats'

export default function App() {
  return (
    <AppLayout>
      <UpdateNotification />
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/control" element={<DeviceControl />} />
        <Route path="/cameras" element={<Cameras />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/stats/tokens" element={<TokenStats />} />
        <Route path="/stats/triggers" element={<TriggerStats />} />
        <Route path="/vision" element={<VisionSettings />} />
        <Route path="/triggers" element={<TriggerRules />} />
        <Route path="/trigger-logs" element={<TriggerLogs />} />
        <Route path="/xiaozhi" element={<XiaozhiSettings />} />
        <Route path="/license" element={<LicenseSettings />} />
        {/* <Route path="/wechat" element={<WeChatLogin />} /> */}
        <Route path="/docs" element={<McpDocs />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  )
}
