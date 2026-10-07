const puppeteer = require('puppeteer');



(async () => {

&#x20; const browser = await puppeteer.launch({ headless: 'new' });

&#x20; const page = await browser.newPage();

&#x20; 

&#x20; let networkRequests = \[];

&#x20; let consoleLogs = \[];

&#x20; 

&#x20; page.on('request', request => {

&#x20;   const url = request.url();

&#x20;   if (!url.startsWith('http://localhost:3001') \&\& !url.startsWith('data:')) {

&#x20;      networkRequests.push({ url, method: request.method() });

&#x20;   } else if (url.includes('/api/')) {

&#x20;      networkRequests.push({ url, method: request.method() });

&#x20;   }

&#x20; });



&#x20; page.on('console', msg => {

&#x20;   if (msg.type() === 'error' || msg.type() === 'warning') {

&#x20;       const text = msg.text();

&#x20;       if (!text.includes('React Router') \&\& !text.includes('Fast Refresh') \&\& !text.includes('useLayoutEffect does nothing on the server')) {

&#x20;           consoleLogs.push(`\[${msg.type()}] ${text}`);

&#x20;       }

&#x20;   }

&#x20; });

&#x20; 

&#x20; page.on('pageerror', err => {

&#x20;    consoleLogs.push(`\[uncaught] ${err.toString()}`);

&#x20; });



&#x20; async function checkPage(path, name, isMobile = false) {

&#x20;   if (isMobile) {

&#x20;       await page.setViewport({ width: 375, height: 812 });

&#x20;   } else {

&#x20;       await page.setViewport({ width: 1280, height: 800 });

&#x20;   }

&#x20;   

&#x20;   console.log(`Checking ${name} at ${path} (Mobile: ${isMobile})`);

&#x20;   await page.goto(`http://localhost:3001${path}`, { waitUntil: 'networkidle2' });

&#x20;   await new Promise(r => setTimeout(r, 1000));

&#x20;   

&#x20;   // Check horizontal scroll

&#x20;   const hasHorizontalScroll = await page.evaluate(() => {

&#x20;       return document.documentElement.scrollWidth > window.innerWidth;

&#x20;   });

&#x20;   

&#x20;   if (hasHorizontalScroll) {

&#x20;       console.log(`❌ Horizontal scroll detected on ${name}! scrollWidth: ${await page.evaluate(() => document.documentElement.scrollWidth)}, innerWidth: ${await page.evaluate(() => window.innerWidth)}`);

&#x20;   } else {

&#x20;       console.log(`✅ No horizontal scroll on ${name}`);

&#x20;   }

&#x20;   

&#x20;   // Try to click some buttons if any

&#x20;   try {

&#x20;      const buttons = await page.$$('button');

&#x20;      if (buttons.length > 0) {

&#x20;          await buttons\[0].hover(); // just test interaction

&#x20;      }

&#x20;   } catch(e) {}

&#x20; }

&#x20; 

&#x20; // Routes to test based on typical app

&#x20; const routes = \[

&#x20;   { path: '/', name: 'Landing/Home' },

&#x20;   { path: '/mission/new', name: 'Mission Creation' },

&#x20;   { path: '/missions', name: 'Mission List' },

&#x20;   { path: '/settings', name: 'Settings' },

&#x20;   { path: '/integrations', name: 'Integrations' }

&#x20; ];

&#x20; 

&#x20; for (const r of routes) {

&#x20;     await checkPage(r.path, r.name, false);

&#x20;     await checkPage(r.path, r.name, true);

&#x20; }

&#x20; 

&#x20; // Additionally try to find a mission to test Mission Detail

&#x20; console.log("Checking Mission Detail (assuming demo mode has one)...");

&#x20; // Let's go to /missions and click the first mission link

&#x20; await page.setViewport({ width: 1280, height: 800 });

&#x20; await page.goto('http://localhost:3001/missions', { waitUntil: 'networkidle2' });

&#x20; 

&#x20; // Enable demo mode if not enabled, or just rely on the existing state.

&#x20; // Wait, Demo Mode might require clicking a button to activate.

&#x20; const hasDemoToggle = await page.$('text/Demo Mode');

&#x20; if (hasDemoToggle) {

&#x20;     console.log("Found Demo Mode toggle, clicking it...");

&#x20;     await page.evaluate(() => {

&#x20;         const els = Array.from(document.querySelectorAll('\*'));

&#x20;         const btn = els.find(e => e.textContent \&\& e.textContent.includes('Demo Mode') \&\& e.tagName === 'BUTTON');

&#x20;         if(btn) btn.click();

&#x20;     });

&#x20;     await new Promise(r => setTimeout(r, 1000));

&#x20; }

&#x20; 

&#x20; // Try to find a mission link

&#x20; const missionLinks = await page.$$('a\[href^="/mission/"]');

&#x20; if (missionLinks.length > 0) {

&#x20;     const href = await page.evaluate(el => el.getAttribute('href'), missionLinks\[0]);

&#x20;     console.log(`Found mission link: ${href}`);

&#x20;     await checkPage(href, 'Mission Detail', false);

&#x20;     await checkPage(href, 'Mission Detail', true);

&#x20; } else {

&#x20;     console.log("No mission links found on /missions to test Mission Detail.");

&#x20; }

&#x20; 

&#x20; console.log("\\n--- Network Requests out of scope ---");

&#x20; networkRequests.forEach(r => console.log(`${r.method} ${r.url}`));

&#x20; 

&#x20; console.log("\\n--- Console Errors/Warnings ---");

&#x20; const uniqueLogs = \[...new Set(consoleLogs)];

&#x20; uniqueLogs.forEach(l => console.log(l));

&#x20; 

&#x20; await browser.close();

})();



