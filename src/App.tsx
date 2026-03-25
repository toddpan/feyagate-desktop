import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Auth from './pages/Auth'
import Devices from './pages/Devices'
import Cameras from './pages/Cameras'

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/cameras" element={<Cameras />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  )
}
