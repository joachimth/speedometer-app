#!/usr/bin/env node
/**
 * capture-screenshots.js
 *
 * Starter en lokal HTTP-server, åbner speedometer-appen i en headless browser,
 * injicerer simuleret data og tager screenshots til README.
 *
 * Krav: npx playwright install chromium
 * Kørsel: node capture-screenshots.js
 */

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3737;
const OUT_DIR = join(__dirname, 'screenshots');

// MIME types
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// ─── Local HTTP server ────────────────────────────────────────────────────────
function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let filePath = join(__dirname, req.url === '/' ? 'index.html' : req.url);
      // Strip query strings
      filePath = filePath.split('?')[0];

      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = extname(filePath);
      const mime = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(readFileSync(filePath));
    });

    server.listen(PORT, () => {
      console.log(`Server kører på http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

// ─── Inject simulated app state into DOM ─────────────────────────────────────
async function injectSimulatedState(page, { speed, limit, road, started }) {
  await page.evaluate(({ speed, limit, road, started }) => {
    // Set displayed values directly
    const el = (id) => document.getElementById(id);
    if (el('speed'))      el('speed').textContent      = speed;
    if (el('speedlimit')) el('speedlimit').textContent  = limit;
    if (el('roadinfo'))   el('roadinfo').textContent    = road;

    // Toggle button icons to "running" state if started
    if (started) {
      const start = el('icon-start');
      const ok    = el('icon-ok');
      if (start) start.style.display = 'none';
      if (ok)    ok.style.display    = 'inline-block';
    }
  }, { speed, limit, road, started });
}

// ─── Screenshot scenarios ─────────────────────────────────────────────────────
const SCENARIOS = [
  {
    name: 'portrait-driving',
    label: 'Portrait – kørende',
    viewport: { width: 390, height: 844 },    // iPhone 14
    state: { speed: '72', limit: '80', road: 'Kongevej (tertiary)', started: true },
  },
  {
    name: 'portrait-idle',
    label: 'Portrait – startskærm',
    viewport: { width: 390, height: 844 },
    state: { speed: '00', limit: '000', road: '', started: false },
  },
  {
    name: 'landscape-driving',
    label: 'Landscape – kørende',
    viewport: { width: 844, height: 390 },    // iPhone 14 landscape
    state: { speed: '108', limit: '130', road: 'E20 Motorvej (motorway)', started: true },
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const server = await startServer();
  const browser = await chromium.launch();

  try {
    for (const scenario of SCENARIOS) {
      console.log(`📸 ${scenario.label} …`);

      const context = await browser.newContext({
        viewport: scenario.viewport,
        deviceScaleFactor: 2,
        // Block axios CDN request – we don't need it for screenshots
        serviceWorkers: 'block',
      });

      // Intercept axios CDN so it doesn't hang
      await context.route('**unpkg.com**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: 'window.axios = { get: () => Promise.resolve({ data: { elements: [] } }) };',
        });
      });

      const page = await context.newPage();
      await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });

      // Small pause for CSS to settle
      await page.waitForTimeout(300);
      await injectSimulatedState(page, scenario.state);
      await page.waitForTimeout(100);

      const outPath = join(OUT_DIR, `${scenario.name}.png`);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`   → ${outPath}`);

      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
    console.log('\n✅ Alle screenshots gemt i screenshots/');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
