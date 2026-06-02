#!/usr/bin/env python3
"""
Generates speedometer-app screenshots using a local HTTP server + Playwright.
Run from the repo root: python3 capture-screenshots.py
"""

import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright

PORT = 3738
ROOT = Path(__file__).parent
OUT  = ROOT / "screenshots"
OUT.mkdir(exist_ok=True)

# ─── Local HTTP server ────────────────────────────────────────────────────────
class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, *args):
        pass

def start_server():
    server = HTTPServer(("localhost", PORT), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server

# ─── Inject simulated app state ───────────────────────────────────────────────
def inject_state(page, speed, limit, road, started, over_limit=False):
    page.evaluate("""([speed, limit, road, started, over_limit]) => {
        const el = id => document.getElementById(id);
        if (el('speed')) {
            el('speed').textContent = speed;
            el('speed').classList.toggle('over-limit', over_limit);
        }
        if (el('speedlimit')) el('speedlimit').textContent = limit;
        if (el('roadinfo'))   el('roadinfo').textContent   = road;

        // GPS dot + label
        const dot   = el('gps-dot');
        const label = el('gps-label');
        if (started && dot)   { dot.classList.add('active'); }
        if (started && label) { label.textContent = 'GPS aktiv'; label.classList.add('active'); }

        // Button state
        const btn = el('clickme');
        const s   = el('icon-start');
        const o   = el('icon-ok');
        if (started) {
            if (btn) btn.classList.add('running');
            if (s)   s.style.display = 'none';
            if (o)   o.style.display = 'inline-block';
        }
    }""", [speed, limit, road, started, over_limit])

# ─── Scenarios ────────────────────────────────────────────────────────────────
SCENARIOS = [
    dict(name="portrait-idle",
         w=390, h=844,
         speed="00",  limit="000", road="",
         started=False, over_limit=False),

    dict(name="portrait-driving",
         w=390, h=844,
         speed="72",  limit="80", road="Kongevej (tertiary)",
         started=True, over_limit=False),

    dict(name="landscape-driving",
         w=844, h=390,
         speed="108", limit="130", road="E20 Motorvej (motorway)",
         started=True, over_limit=False),
]

# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    server = start_server()
    print(f"Server kører på http://localhost:{PORT}")

    with sync_playwright() as p:
        browser = p.chromium.launch()

        for s in SCENARIOS:
            print(f"  {s['name']} ...")
            ctx = browser.new_context(
                viewport={"width": s["w"], "height": s["h"]},
                device_scale_factor=2,
            )

            # Stub axios (no real GPS/network needed)
            ctx.route("**/unpkg.com/**", lambda route: route.fulfill(
                status=200,
                content_type="application/javascript",
                body="window.axios = { get: () => Promise.resolve({ data: { elements: [] } }) };"
            ))

            page = ctx.new_page()
            page.goto(f"http://localhost:{PORT}/", wait_until="networkidle")

            # Wait for fonts to be ready
            page.evaluate("() => document.fonts.ready")
            page.wait_for_timeout(400)

            inject_state(page, s["speed"], s["limit"], s["road"], s["started"], s["over_limit"])
            page.wait_for_timeout(200)

            out_path = OUT / f"{s['name']}.png"
            page.screenshot(path=str(out_path))
            print(f"   → {out_path}")

            ctx.close()

        browser.close()

    server.shutdown()
    print("\n Alle screenshots gemt i screenshots/")

if __name__ == "__main__":
    main()
