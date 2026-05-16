import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ShopHomePage from './pages/ShopHomePage';
import DashboardPage from './pages/DashboardPage';
import RepairDetailPage from './pages/RepairDetailPage';
import CreateWorkOrderPage from './pages/CreateWorkOrderPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ShopHomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/repair/:repairId" element={<RepairDetailPage />} />
        <Route path="/work-orders/new" element={<CreateWorkOrderPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
