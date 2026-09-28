import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MissionProvider } from './store/MissionStore';
import NewMissionModal from './components/NewMissionModal';
import Landing from './landing/Landing';
import AppLayout from './app/AppLayout';
import Dashboard from './app/Dashboard';
import MissionDetail from './app/mission/MissionDetail';
import Workforce from './app/Workforce';
import Approvals from './app/Approvals';
import TemplatesPage from './app/TemplatesPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <MissionProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="missions/:id" element={<MissionDetail />} />
            <Route path="workforce" element={<Workforce />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="templates" element={<TemplatesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <NewMissionModal />
      </MissionProvider>
    </BrowserRouter>
  );
}
