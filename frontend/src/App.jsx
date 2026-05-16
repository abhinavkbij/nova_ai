import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { NovaProvider, useNova } from './context/NovaContext';
import NovaAssistant from './components/NovaAssistant';
import ShopHomePage from './pages/ShopHomePage';
import DashboardPage from './pages/DashboardPage';
import RepairDetailPage from './pages/RepairDetailPage';
import CreateWorkOrderPage from './pages/CreateWorkOrderPage';

function GlobalNova() {
  const { screenContext, dispatchAction } = useNova();
  return <NovaAssistant screenContext={screenContext} onAction={dispatchAction} />;
}

export default function App() {
  return (
    <NovaProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ShopHomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/repair/:repairId" element={<RepairDetailPage />} />
          <Route path="/work-orders/new" element={<CreateWorkOrderPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <GlobalNova />
      </BrowserRouter>
    </NovaProvider>
  );
}
