import React from 'react';
import Navbar from './Navbar';
import Hero from './Hero';
import Difference from './Difference';
import HowItWorks from './HowItWorks';
import Agents from './Agents';
import Templates from './Templates';
import FinalCta from './FinalCta';
import Footer from './Footer';

export default function Landing() {
  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 bg-grid opacity-30 pointer-events-none -z-20" />
      <Navbar />
      <main>
        <Hero />
        <Difference />
        <HowItWorks />
        <Agents />
        <Templates />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
