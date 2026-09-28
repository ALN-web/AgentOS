import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import BentoGrid from './components/BentoGrid';
import Features from './components/Features';
import Architecture from './components/Architecture';
import Pricing from './components/Pricing';
import MissionTemplates from './components/MissionTemplates';
import CtaDashboard from './components/CtaDashboard';
import Footer from './components/Footer';
import LaunchMissionModal from './components/LaunchMissionModal';
import WatchDemoModal from './components/WatchDemoModal';

export default function App() {
  const [missionModalOpen, setMissionModalOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const handleOpenMission = (template = null) => {
    setSelectedTemplate(template);
    setMissionModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white selection:bg-[#eb6920] selection:text-white relative">
      {/* Background Subtle Grid Effect */}
      <div className="fixed inset-0 bg-grid opacity-30 pointer-events-none -z-20" />

      {/* Navigation */}
      <Navbar onOpenMissionModal={() => handleOpenMission(null)} />

      {/* Main Content Layout */}
      <main>
        {/* Hero Section */}
        <Hero
          onOpenMissionModal={() => handleOpenMission(null)}
          onOpenDemoModal={() => setDemoModalOpen(true)}
        />

        {/* Bento Grid (Hero Dashboard - Frame 00:00 - 00:03) */}
        <BentoGrid onOpenMissionModal={() => handleOpenMission(null)} />

        {/* Reusable Features Section (Frame 00:04 - 00:10) */}
        <Features />

        {/* Architecture Section: Goal -> Planner -> ... -> Mission Complete */}
        <Architecture />

        {/* Pricing Plans (Frame 00:11 - 00:13) */}
        <Pricing onOpenMissionModal={() => handleOpenMission(null)} />

        {/* Mission Templates / Showcase Cards (Frame 00:14 - 00:16) */}
        <MissionTemplates onSelectTemplate={(template) => handleOpenMission(template)} />

        {/* Pre-Footer CTA with Mini Dashboard (Frame 00:17 - 00:19) */}
        <CtaDashboard onOpenMissionModal={() => handleOpenMission(null)} />
      </main>

      {/* Footer (Frame 00:19 - 00:20) */}
      <Footer />

      {/* Interactive Modals */}
      <LaunchMissionModal
        isOpen={missionModalOpen}
        onClose={() => {
          setMissionModalOpen(false);
          setSelectedTemplate(null);
        }}
        initialTemplate={selectedTemplate}
      />

      <WatchDemoModal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
      />
    </div>
  );
}
