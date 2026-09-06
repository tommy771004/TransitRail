// Local-only browser regression: hydrate a shrinking date window, then submit.
// No provider, database, telemetry or public application requests are made.
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { createServer } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { chromium } from "playwright";

const dir = await mkdtemp(resolve(".feedback-browser-"));
const server = await createServer({
  configFile: false,
  plugins: [tailwindcss()],
  esbuild: { jsx: "automatic" },
  server: { host: "127.0.0.1", port: 0 },
});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await writeFile(resolve(dir, "index.html"), '<html><body><div id="root"></div><script type="module" src="./harness.tsx"></script></body></html>');
  await writeFile(resolve(dir, "harness.tsx"), `
    import '../src/index.css';
    import { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { SearchForm } from '../src/components/SearchForm';
    import i18n from '../src/i18n';
    import { providerDateValues } from '../src/data/countries';
    await i18n.changeLanguage('en');
    function Harness() {
      const dates = providerDateValues('japan', 7);
      const [params, setParams] = useState({country:'japan', origin:'Asakusa', destination:'Shimbashi', date:dates[6]});
      const [submitted, setSubmitted] = useState('');
      const noop = () => {};
      return <><output id="selected">{params.date}</output><output id="submitted">{submitted}</output>
        <SearchForm params={params} isSearching={false} recentHistory={[]} favorites={[]}
          onToggleFavorite={noop} onRemoveFavorite={noop} onRepeatFavoriteSearch={noop}
          onChange={setParams} onSearch={async (o,d,date) => setSubmitted(date)}
          onOpenStations={noop} onOpenWorkflow={noop} onRepeatSearch={noop} onTogglePinHistory={noop}/>
      </>;
    }
    createRoot(document.getElementById('root')).render(<Harness/>);
  `);
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === "string") throw new Error("Missing local server port");
  const base = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (url.pathname === "/api/transit/stations") {
      return route.fulfill({ json: { coverage: { dateRange: { days: 1 } } } });
    }
    return route.continue();
  });
  await page.goto(`${base}/${relative(resolve(), dir)}/index.html`);
  const notice = page.getByRole("status").filter({ hasText: "outside the currently offered dates" });
  await notice.waitFor();
  const originalDate = await page.locator("#selected").textContent();
  if (!(await notice.textContent())?.includes(originalDate!)) throw new Error("Requested day was not preserved");
  const search = page.getByRole("button", { name: "Search timetable", exact: true });
  await search.click();
  if (await page.locator("#submitted").textContent()) throw new Error("Invalid day was submitted");
  const today = page.getByRole("button", { name: /^Today,/ });
  await today.click();
  await search.click();
  await page.waitForFunction(() => !!document.querySelector("#submitted")?.textContent);
  if (await page.locator("#submitted").textContent() !== await page.locator("#selected").textContent()) {
    throw new Error("Submitted day differs from selection");
  }
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const dark of [false, true]) {
      await page.evaluate((enabled) => document.documentElement.classList.toggle("dark", enabled), dark);
      if (!(await search.isVisible())) throw new Error(`Search is hidden at ${width}px, dark=${dark}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      if (overflow) throw new Error(`Page overflows at ${width}px, dark=${dark}`);
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("PASS: styled mobile/desktop and light/dark; hydration preserves requested date, blocks invalid submit, and submits the explicitly selected day.");
} finally {
  await browser?.close();
  await server.close();
  await rm(dir, { recursive: true, force: true });
}
