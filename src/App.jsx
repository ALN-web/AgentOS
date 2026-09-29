import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import ErrorBoundary from './components/ErrorBoundary';
import { MissionProvider } from './store/MissionStore';
import NewMissionModal from './components/NewMissionModal';
import Landing from './landing/Landing';
import AppLayout from './app/AppLayout';
import Dashboard from './app/Dashboard';
import MissionDetail from './app/mission/MissionDetail';
import Workforce from './app/Workforce';
import Approvals from './app/Approvals';
import TemplatesPage from './app/TemplatesPage';
import Missions from './app/Missions';
import FeaturesPage from './app/FeaturesPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <MotionConfig reducedMotion="user">
          <MissionProvider>
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="missions" element={<Missions />} />
                <Route path="missions/:id" element={<MissionDetail />} />
                <Route path="features" element={<FeaturesPage />} />
                <Route path="workforce" element={<Workforce />} />
                <Route path="approvals" element={<Approvals />} />
                <Route path="templates" element={<TemplatesPage />} />
                <Route path="*" element={<Navigate to="/app" replace />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <NewMissionModal />
          </MissionProvider>
        </MotionConfig>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
