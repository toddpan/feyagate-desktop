import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import UpdateNotification from './components/UpdateNotification'
import Auth from './pages/Auth'
import Devices from './pages/Devices'
import Cameras from './pages/Cameras'
import McpDocs from './pages/McpDocs'

export default function App() {
  return (
    <AppLayout>
      <UpdateNotification />
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/cameras" element={<Cameras />} />
        <Route path="/docs" element={<McpDocs />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  )
}
