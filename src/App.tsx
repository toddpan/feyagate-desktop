import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import UpdateNotification from './components/UpdateNotification'
import Auth from './pages/Auth'
import XiaomiAuth from './pages/XiaomiAuth'
import Devices from './pages/Devices'
import Cameras from './pages/Cameras'
// import DeviceControl from './pages/DeviceControl'
import XiaozhiSettings from './pages/XiaozhiSettings'
import LicenseSettings from './pages/LicenseSettings'
import McpDocs from './pages/McpDocs'
import VisionSettings from './pages/VisionSettings'
import TriggerRules from './pages/TriggerRules'
import TriggerLogs from './pages/TriggerLogs'
import Dashboard from './pages/Dashboard'
import TokenStats from './pages/TokenStats'
import TriggerStats from './pages/TriggerStats'
import TuyaAuth from './pages/TuyaAuth'
import MideaAuth from './pages/MideaAuth'
import EwelinkAuth from './pages/EwelinkAuth'
import Schedules from './pages/Schedules'

export default function App() {
  return (
    <AppLayout>
      <UpdateNotification />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/devices" element={<Devices />} />
        {/* <Route path="/control" element={<DeviceControl />} /> */}
        <Route path="/cameras" element={<Cameras />} />
        <Route path="/stats/tokens" element={<TokenStats />} />
        <Route path="/stats/triggers" element={<TriggerStats />} />
        <Route path="/schedules" element={<Schedules />} />
        <Route path="/vision" element={<VisionSettings />} />
        <Route path="/triggers" element={<TriggerRules />} />
        <Route path="/trigger-logs" element={<TriggerLogs />} />
        <Route path="/xiaozhi" element={<XiaozhiSettings />} />
        <Route path="/license" element={<LicenseSettings />} />
        <Route path="/platform/xiaomi" element={<XiaomiAuth />} />
        <Route path="/platform/tuya" element={<TuyaAuth />} />
        <Route path="/platform/midea" element={<MideaAuth />} />
        <Route path="/platform/ewelink" element={<EwelinkAuth />} />
        <Route path="/tuya" element={<Navigate to="/platform/tuya" replace />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/docs" element={<McpDocs />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  )
}
