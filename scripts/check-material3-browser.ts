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
    import { MetroResultView } from '../src/components/MetroResultView';
    import { TripDetails } from '../src/components/TripDetails';
    import i18n from '../src/i18n';
    await i18n.changeLanguage('en');

    function Harness() {
      const country = new URLSearchParams(location.search).get('country') || 'japan';
      const date = new URLSearchParams(location.search).get('date') || '2026-09-08';
      const [view, setView] = useState('search');
      const [stationOpen, setStationOpen] = useState(false);
      const [snack, setSnack] = useState();
      const [converted, setConverted] = useState(false);
      const [unknown, setUnknown] = useState(false);
      if (new URLSearchParams(location.search).has('fare')) {
        const trip = { id: 'fare', country: 'hong_kong', date: '2026-09-13', operator: 'MTR', service: 'Tsuen Wan Line', origin: 'Central', destination: unknown ? 'Unknown' : 'Admiralty', departureTime: '10:00', direct: true, stops: [] };
        return <main className="mx-auto max-w-xl p-4">
          <button className="m3-button" onClick={() => setConverted(!converted)}>Change currency</button>
          <button className="m3-button" onClick={() => setUnknown(!unknown)}>Change destination</button>
          <TripDetails trip={trip} formatPrice={t => converted ? 'NT$' + t.price / 0.25 : 'HK$' + t.price} />
        </main>;
      }
      if (new URLSearchParams(location.search).has('metro')) {
        const trip = { id: 'metro', country: 'hong_kong', operator: 'MTR', service: 'TWL', origin: 'Central', destination: 'Jordan', departureTime: '10:00', direct: true, stops: [] };
        return <MetroResultView country="hong_kong" origin="Central" destination="Jordan" date="2026-09-13" results={[trip]} savedIds={new Set()} onModify={() => {}} onSave={() => {}} />;
      }
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
    resolve: { alias: { "@": resolve() } },
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

  for (const width of [320, 390, 1280]) {
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
      const shell = await page.evaluate(() => {
        const navigationSurface = document.querySelector<HTMLElement>(".m3-nav-surface")!;
        const navigationBar = document.querySelector<HTMLElement>(".m3-nav-bar")!;
        const navigationBox = navigationSurface.getBoundingClientRect();
        return {
          header: Math.round(document.querySelector("header")!.getBoundingClientRect().height),
          nav: Math.round(navigationBar.getBoundingClientRect().height),
          navComputedHeight: getComputedStyle(navigationBar).height,
          navSurfaceWidth: Math.round(navigationBox.width),
          navLeft: navigationBox.left,
          navRight: navigationBox.right,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      const expectedNavHeight = width < 768 ? 60 : 80;
      if (shell.header !== 64) throw new Error(`Top app bar is ${shell.header}px at ${width}px/${colorScheme}`);
      if (shell.nav !== expectedNavHeight) throw new Error(`Navigation bar is ${shell.nav}px (${shell.navComputedHeight}) at ${width}px/${colorScheme}`);
      if (width < 768 && shell.navSurfaceWidth !== 270) throw new Error(`Compact navigation is ${shell.navSurfaceWidth}px wide at ${width}px/${colorScheme}`);
      if (shell.navLeft < 0 || shell.navRight > width) throw new Error(`Navigation escapes viewport at ${width}px/${colorScheme}`);
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

  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
    await page.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== base) return route.abort();
      if (url.pathname.startsWith("/api/")) return route.fulfill({ json: {} });
      return route.continue();
    });
    await page.goto(`${base}/${relative(resolve(), dir)}/index.html?metro=1`);
    const details = page.getByRole("button", { name: "Trip details & timeline" });
    await details.waitFor();
    const intermediate = page.getByText("Admiralty", { exact: true });
    if (await intermediate.isVisible()) throw new Error("Metro stops escaped the collapsed details panel");
    await details.focus();
    await page.keyboard.press("Enter");
    await intermediate.waitFor({ state: "visible" });
    if (await intermediate.count() !== 1) throw new Error("Duplicate Metro stop sequence");
    if (await page.getByText("Tsim Sha Tsui", { exact: true }).count() !== 1) throw new Error("Incomplete Metro stop sequence");
    if (await page.getByRole("button", { name: /Show .* intermediate stops/ }).count()) throw new Error("Metro stops require a second disclosure");
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Metro details overflow at ${width}px`);
    if (process.env.UI_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.UI_SCREENSHOT_DIR, `metro-details-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "Hide details" }).click();
    if (await intermediate.isVisible()) throw new Error("Metro stops remain visible after closing details");
    await page.close();
  }

  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    let recovered = false;
    let staticReads = 0;
    let apiReads = 0;
    await page.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== base) return route.abort();
      if (url.pathname === "/api/transit/audit") return route.fulfill({ status: 204 });
      if (url.pathname === "/catalog/united_kingdom.json") {
        staticReads++;
        if (!recovered) return route.fulfill({ status: 503, body: "Unavailable" });
        const line = { id: "recovered", name: "Recovered line", stations: [{ name: "Recovered Station" }, { name: "B" }] };
        return route.fulfill({ json: {
          country: "united_kingdom", serviceDate: "2026-09-12", stations: ["Recovered Station", "B"], lines: [line],
          regions: [{ id: "region", name: "Region", lines: [line] }],
          coverage: { mode: "provider", date: "2026-09-12", dateRange: { start: "2026-09-12", end: "2026-09-14", days: 3, liveOnly: false } },
        } });
      }
      if (url.pathname === "/api/transit/catalog") {
        apiReads++;
        return route.fulfill({ status: 503, body: "Unavailable" });
      }
      return route.continue();
    });
    await page.goto(`${base}/${relative(resolve(), dir)}/index.html?country=united_kingdom&date=2026-09-13`);
    await page.locator("#open-stations").click();
    const reload = page.getByRole("dialog").getByRole("button", { name: /reload/i });
    await reload.waitFor();
    recovered = true;
    await reload.click();
    await page.getByRole("dialog").getByText("Recovered Station", { exact: true }).waitFor();
    if (staticReads !== 2 || apiReads !== 1) throw new Error("Station reload did not retry or valid provider JSON contacted the API");
    await page.close();
  }

  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
    let fareReads = 0;
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== base) return route.abort();
      if (url.pathname === "/fares/hong_kong.json") {
        fareReads++;
        return route.fulfill({ json: JSON.parse(readFileSync(resolve("public/fares/hong_kong.json"), "utf8")) });
      }
      return route.continue();
    });
    await page.goto(`${base}/${relative(resolve(), dir)}/index.html?fare=1`);
    await page.getByRole("button", { name: "Trip details & timeline" }).waitFor();
    if (fareReads) throw new Error("Collapsed details downloaded fares");
    await page.getByRole("button", { name: "Trip details & timeline" }).click();
    const fare = page.locator("[data-trip-fare]");
    await fare.getByText("HK$5", { exact: true }).waitFor();
    if (await fare.count() !== 1) throw new Error("Duplicate fare blocks");
    await page.getByRole("button", { name: "Change currency" }).click();
    await fare.getByText("NT$20", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Change destination" }).click();
    await fare.waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Change destination" }).click();
    await fare.getByText("NT$20", { exact: true }).waitFor();
    if (fareReads !== 1) throw new Error("Fare preferences bypassed the session cache");
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Fare details overflow at ${width}px`);
    if (errors.length) throw new Error(errors.join("\n"));
    if (process.env.UI_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.UI_SCREENSHOT_DIR, `fare-details-${width}.png`), fullPage: true });
    await page.close();
  }

  console.log("PASS: M3 shell, four locales, navigation, snackbar and station dialog across mobile/desktop and light/dark.");
  console.log("PASS: Metro stop sequence uses one keyboard-accessible disclosure across mobile/desktop.");
  console.log("PASS: Station reload retries failed reads and accepts provider JSON within its valid date range.");
  console.log("PASS: Official fare details load on expansion, convert currency and hide unmatched journeys across mobile/desktop.");
} finally {
  await browser?.close();
  await server?.close();
  await rm(dir, { recursive: true, force: true });
}
