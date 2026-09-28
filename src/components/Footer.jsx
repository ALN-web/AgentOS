import React from 'react';

export default function Footer() {
  const mainPages = [
    { name: 'Home', href: '#home' },
    { name: 'Features', href: '#features' },
    { name: 'Architecture', href: '#architecture' },
    { name: 'Agents', href: '#agents' },
    { name: 'Mission Templates', href: '#mission-templates' },
    { name: 'About', href: '#about' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'Contact', href: '#contact' }
  ];

  const socialMedia = [
    { name: 'Twitter / X', href: 'https://x.com' },
    { name: 'GitHub', href: 'https://github.com' },
    { name: 'LinkedIn', href: 'https://linkedin.com' },
    { name: 'Discord', href: 'https://discord.com' }
  ];

  const systemStuff = [
    { name: 'Style Guide', href: '#' },
    { name: 'Licensing', href: '#' },
    { name: 'Instructions', href: '#' },
    { name: 'Change Log', href: '#' }
  ];

  return (
    <footer id="contact" className="border-t border-white/10 bg-[#000000] pt-20 pb-12 relative overflow-hidden">
      <div className="max-w-[1240px] mx-auto px-6">
        
        {/* Main Footer Row matching video Frame 00:19 - 00:20 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-16 border-b border-white/5">
          
          {/* Left Column: Brand & Description */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-extrabold tracking-wider text-white">AGENT</span>
              <span className="text-xl font-extrabold text-[#eb6920]">OS</span>
              <div className="w-2.5 h-2.5 rounded-full bg-[#eb6920] shadow-[0_0_10px_#eb6920]" />
            </div>

            <h3 className="text-xl font-bold text-white tracking-tight">
              Transform Your Work with AgentOS
            </h3>

            <p className="text-xs text-gray-400 leading-relaxed max-w-sm">
              Don't tell AI what to do. Tell it what you want done. Turn complex goals into completed outcomes through planning, execution, verification, recovery, and autonomous collaboration.
            </p>
          </div>

          {/* Right Columns */}
          <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
            
            {/* Column 1: Main Pages */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-4">
                Main Pages
              </div>
              <ul className="space-y-2.5 text-xs text-gray-400">
                {mainPages.map((page) => (
                  <li key={page.name}>
                    <a
                      href={page.href}
                      className="hover:text-white hover:text-[#eb6920] transition-colors"
                    >
                      {page.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 2: Social Media */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-4">
                Social Media
              </div>
              <ul className="space-y-2.5 text-xs text-gray-400">
                {socialMedia.map((soc) => (
                  <li key={soc.name}>
                    <a
                      href={soc.href}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-white hover:text-[#eb6920] transition-colors"
                    >
                      {soc.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Webflow Stuff / System */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-4">
                Webflow Stuff
              </div>
              <ul className="space-y-2.5 text-xs text-gray-400">
                {systemStuff.map((item) => (
                  <li key={item.name}>
                    <a
                      href={item.href}
                      className="hover:text-white hover:text-[#eb6920] transition-colors"
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 gap-4">
          <div>
            © 2026 AgentOS Inc. All rights reserved.
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            <span className="text-gray-300 font-mono text-[11px]">All Autonomous Swarms Operational</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
