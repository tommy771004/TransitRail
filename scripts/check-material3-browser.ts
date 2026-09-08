// Browser smoke check for the shared Material 3 shell and modal surfaces.
// It uses a local component harness and never contacts transit providers.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { createServer } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { chromium } from "playwright";

const dir = await mkdtemp(resolve(".material3-browser-"));
let server: Awaited<ReturnType<typeof createServer>> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

try {
  await writeFile(resolve(dir, "index.html"), '<html><body><div id="root"></div><script type="module" src="./harness.tsx"></script></body></html>');
  await writeFile(resolve(dir, "harness.tsx"), `
    import '../src/index.css';
    import { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { Header } from '../src/components/Header';
    import { BottomNav } from '../src/components/BottomNav';
    import { Snackbar } from '../src/components/Snackbar';
    import { StationBrowser } from '../src/components/StationBrowser';
    import i18n from '../src/i18n';
    await i18n.changeLanguage('en');

    function Harness() {
      const country = new URLSearchParams(location.search).get('country') || 'japan';
      const date = new URLSearchParams(location.search).get('date') || '2026-09-08';
      const [view, setView] = useState('search');
      const [stationOpen, setStationOpen] = useState(false);
      const [snack, setSnack] = useState();
      return <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Header onMenuOpen={() => {}} onProfileOpen={() => {}} timezone="Asia/Taipei" homeCurrency="TWD" />
        <main className="px-4 pb-nav pt-22">
          <button id="open-stations" className="m3-button" onClick={() => setStationOpen(true)}>Open station picker</button>
          <button id="show-snack" className="m3-button" onClick={() => setSnack({ id: Date.now(), text: 'Route saved' })}>Show confirmation</button>
        </main>
        <BottomNav activeView={view} unreadAlerts={1} onNavigate={setView} onOpenSettings={() => {}} country="japan" />
        {stationOpen ? <StationBrowser country={country} target="origin" onBack={() => setStationOpen(false)} onSelectStation={() => setStationOpen(false)} selectedDate={date} /> : null}
        <Snackbar snack={snack} onDismiss={() => setSnack(undefined)} />
      </div>;
    }
    createRoot(document.getElementById('root')).render(<Harness />);
  `);

  server = await createServer({
    configFile: false,
    plugins: [tailwindcss()],
    esbuild: { jsx: "automatic" },
    cacheDir: resolve(dir, ".vite-cache"),
    optimizeDeps: {
      entries: resolve(dir, "harness.tsx"),
      include: [
        "i18next",
        "lucide-react",
        "motion/react",
        "react",
        "react-dom/client",
        "react-i18next",
        "react/jsx-dev-runtime",
        "react/jsx-runtime",
      ],
    },
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === "string") throw new Error("Missing local server port");
  const base = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });

  for (const width of [390, 1280]) {
    for (const colorScheme of ["light", "dark"] as const) {
     for (const country of ["japan", "korea", "belgium"]) {
      const serviceDate = country === "japan" ? "2026-09-08" : JSON.parse(readFileSync(resolve(`public/catalog/${country}.json`), "utf8")).serviceDate;
      const page = await browser.newPage({
        viewport: { width, height: 844 },
        colorScheme,
        reducedMotion: "reduce",
      });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("response", (response) => {
        if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
      });
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== base) return route.abort();
        if (url.pathname === "/favicon.ico") return route.fulfill({ status: 204 });
        if (url.pathname === "/api/transit/audit") return route.fulfill({ status: 204 });
        if (url.pathname === "/api/transit/catalog") {
          if (country !== "japan") return route.fulfill({ json: JSON.parse(readFileSync(resolve(`public/catalog/${country}.json`), "utf8")) });
          const line = { id: "asakusa", name: "Asakusa Line", stations: [{ name: "Asakusa" }, { name: "Shimbashi" }] };
          return route.fulfill({ json: {
            country: "japan", serviceDate: "2026-09-08", coverage: { mode: "scraped", date: "2026-09-08" },
            regions: [{ id: "tokyo", name: "Tokyo", lines: [line] }],
            lines: [line], stations: ["Asakusa", "Shimbashi"],
          } });
        }
        return route.continue();
      });

      await page.goto(`${base}/${relative(resolve(), dir).replaceAll("\\", "/")}/index.html?country=${country}&date=${serviceDate}`, {
        waitUntil: "networkidle",
      });
      await page.locator("header").waitFor();
      await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), colorScheme === "dark");
      const shell = await page.evaluate(() => ({
        header: Math.round(document.querySelector("header")!.getBoundingClientRect().height),
        nav: Math.round(document.querySelector("nav > div")!.getBoundingClientRect().height),
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      }));
      if (shell.header !== 64) throw new Error(`Top app bar is ${shell.header}px at ${width}px/${colorScheme}`);
      if (shell.nav !== 80) throw new Error(`Navigation bar is ${shell.nav}px at ${width}px/${colorScheme}`);
      if (shell.overflow) throw new Error(`Shell overflows at ${width}px/${colorScheme}`);

      for (const locale of ["en", "zh-TW", "ja", "ko"]) {
        await page.locator("header select").selectOption(locale);
        if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
          throw new Error(`Header overflows at ${width}px/${colorScheme}/${locale}`);
        }
      }

      await page.locator("nav button").nth(3).click();
      if (await page.locator("nav button").nth(3).getAttribute("aria-current") !== "page") {
        throw new Error("Bottom navigation did not expose its active destination");
      }
      await page.locator("#show-snack").click();
      await page.getByRole("status").filter({ hasText: "Route saved" }).waitFor();
      await page.locator("#open-stations").click();
      const dialog = page.getByRole("dialog", { name: /station|駅|역|車站/i });
      await dialog.waitFor();
      await page.waitForFunction(() => !document.querySelector('[role="dialog"] .animate-spin'));
      await dialog.locator("input").fill("a");
      if (country !== "japan") await page.waitForFunction(() => document.querySelectorAll('[role="dialog"] button').length > 100);
      if (!await dialog.evaluate((element) => element.contains(document.activeElement))) {
        throw new Error("Station dialog did not receive focus when opened");
      }
      const dialogFits = await dialog.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return box.left >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight;
      });
      if (!dialogFits) throw new Error(`Station dialog escapes viewport at ${width}px/${colorScheme}`);
      await dialog.evaluate((element) => {
        const focusable = Array.from(element.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
        )).filter((candidate) => candidate.getClientRects().length > 0);
        focusable.at(-1)?.focus();
      });
      await page.keyboard.press("Tab");
      if (!await dialog.evaluate((element) => element.contains(document.activeElement))) {
        throw new Error("Tab escaped the station dialog");
      }
      const endpoints = async () => dialog.evaluate(element => {
        const controls = Array.from(element.querySelectorAll<HTMLElement>("button,input,select,textarea,a[href],[tabindex]"))
          .filter(el => el.tabIndex >= 0 && !el.matches(":disabled") && el.getClientRects().length > 0);
        return { first: document.activeElement === controls[0], last: document.activeElement === controls.at(-1) };
      });
      if (!(await endpoints()).first) throw new Error("Tab did not return to the first control");
      await page.keyboard.press("Shift+Tab");
      if (!(await endpoints()).last) throw new Error("Shift+Tab did not reach the last control");
      await page.evaluate(() => {
        const opener = document.getElementById("open-stations")!;
        for (let node: HTMLElement | null = opener; node; node = node.parentElement) node.inert = false;
        opener.focus();
      });
      await page.keyboard.press("Tab");
      if (!(await endpoints()).first) throw new Error("External focus did not return to the first control");
      const keyboard = await dialog.evaluate(element => {
        let measurements = 0;
        const original = HTMLElement.prototype.getClientRects;
        HTMLElement.prototype.getClientRects = function () { measurements++; return original.call(this); };
        const start = performance.now();
        try {
          for (let i = 0; i < 100; i++) document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: Boolean(i % 2), bubbles: true, cancelable: true }));
          return { milliseconds: performance.now() - start, measurements, buttons: element.querySelectorAll("button").length };
        } finally { HTMLElement.prototype.getClientRects = original; }
      });
      if (keyboard.measurements !== 0) throw new Error(`Repeated Tab remeasured ${keyboard.measurements} controls`);
      console.log(`${country}: ${keyboard.buttons} buttons; 100 Tab events in ${keyboard.milliseconds.toFixed(1)}ms`);
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
      if (await page.evaluate(() => document.activeElement?.id) !== "open-stations") {
        throw new Error("Station dialog did not restore focus when closed");
      }
      if (errors.length) throw new Error(errors.join("\n"));
      await page.close();
     }
    }
  }

  console.log("PASS: M3 shell, four locales, navigation, snackbar and station dialog across mobile/desktop and light/dark.");
} finally {
  await browser?.close();
  await server?.close();
  await rm(dir, { recursive: true, force: true });
}
