import { BaseScraper } from "./base";
import { koreaStationToKorean } from "./stationMaps";
import { koreaRoutes } from "./routes";
import type { ScrapedRoute, ScrapedRouteData } from "./types";
import type { Page } from "playwright";

const KORAIL_MAIN_URL = "https://www.korail.com/global/eng/main";
const KORAIL_LEGACY_URL = "https://www.letskorail.com/ebizbf/EbizBfTicketSearch.do";

interface KorailRow {
  trainName: string;
  departure: string;
  arrival: string;
  duration: string;
  price: string;
  seatClass: "economy" | "first";
}

export class KoreaScraper extends BaseScraper {
  readonly name = "Letskorail";
  readonly country = "korea";
  readonly routes = koreaRoutes;

  async scrape(route: ScrapedRoute, date: string, page: Page): Promise<ScrapedRouteData> {
    const originKo = koreaStationToKorean[route.origin] || route.origin;
    const destKo = koreaStationToKorean[route.destination] || route.destination;
    const [y, m, d] = date.split("-");

    try {
      await page.goto(KORAIL_MAIN_URL, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(2000);

      if (await page.locator('input[name="txtGoStart"]').count()) {
        await this.submitGlobalSearch(page, route, date);
      } else {
        await this.submitLegacySearch(page, originKo, destKo, y, m, d);
      }

      await page.waitForTimeout(5000);
      const bodyText = await page.locator("body").innerText().catch(() => "");
      if (bodyText.includes("abnormal activity") || bodyText.includes("CODE : -8003")) {
        return this.fallbackRoute(route, date, "Korail blocked automated search as macro activity");
      }

      // Parse results table
      const html = await page.content();
      const rows = this.parseTable(html);

      if (rows.length === 0) {
        return this.fallbackRoute(route, date, "Korail returned no parseable timetable rows");
      }

      const results = rows.map((row, i) => ({
        id: `kr-${route.origin}-${route.destination}-${i}`,
        country: "korea" as const,
        operator: "Korail",
        service: row.trainName,
        departureTime: row.departure,
        arrivalTime: row.arrival,
        durationMinutes: this.parseDuration(row.duration),
        price: this.parsePrice(row.price),
        currency: "KRW" as const,
        origin: route.origin,
        destination: route.destination,
        direct: true,
        seatClass: row.seatClass,
        stops: [route.origin, route.destination],
      }));

      return {
        origin: route.origin,
        destination: route.destination,
        date,
        scrapedAt: new Date().toISOString(),
        source: "https://www.letskorail.com",
        results,
      };
    } catch (error) {
      return this.fallbackRoute(route, date, this.errorMessage(error));
    }
  }

  private async submitGlobalSearch(page: Page, route: ScrapedRoute, date: string): Promise<void> {
    const origin = this.stationForGlobalSite(route.origin);
    const destination = this.stationForGlobalSite(route.destination);
    const displayDate = this.formatGlobalDate(date);

    await page.evaluate(`
      (() => {
        const setReadonlyInput = (selector, value) => {
          const input = document.querySelector(selector);
          if (!input) return;
          input.readOnly = false;
          input.value = value;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        };

        setReadonlyInput('input[name="txtGoStart"]', ${JSON.stringify(origin)});
        setReadonlyInput('input[name="txtGoEnd"]', ${JSON.stringify(destination)});
        setReadonlyInput('input[name="startDate"]', ${JSON.stringify(displayDate)});
      })();
    `);

    await this.dismissGlobalModals(page);

    const searchButton = page.locator("button.btn_lookup").first();
    if (!(await searchButton.count())) {
      throw new Error("Korail global search button not found");
    }

    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined),
      searchButton.click({ timeout: 5000 }),
    ]);
  }

  private async dismissGlobalModals(page: Page): Promise<void> {
    const closeButtons = page.locator(".ReactModalPortal .btn_pop-close");
    for (let i = 0; i < 3; i += 1) {
      if (!(await closeButtons.count())) return;
      await closeButtons.first().click({ timeout: 3000 }).catch(() => undefined);
      await page.locator(".ReactModalPortal").first().waitFor({ state: "hidden", timeout: 3000 }).catch(() => undefined);
    }
  }

  private async submitLegacySearch(
    page: Page,
    originKo: string,
    destKo: string,
    y: string,
    m: string,
    d: string,
  ): Promise<void> {
    await page.goto(KORAIL_LEGACY_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(1000);

    const originInput = await page.$("#start");
    const destInput = await page.$("#end");

    if (!originInput || !destInput) {
      throw new Error("Korail search form not found");
    }

    await originInput.fill(originKo);
    await destInput.fill(destKo);

    const dateInput = await page.$('input[name="selGoYear"]');
    if (dateInput) await dateInput.fill(y);
    const monthInput = await page.$('input[name="selGoMonth"]');
    if (monthInput) await monthInput.fill(m);
    const dayInput = await page.$('input[name="selGoDay"]');
    if (dayInput) await dayInput.fill(d);

    const submitBtn = await page.$('input[type="submit"], button[type="submit"], a.imgBtn');
    if (!submitBtn) {
      throw new Error("Korail submit button not found");
    }

    await submitBtn.click();
  }

  private stationForGlobalSite(station: string): string {
    return station.replace(/\s*\([A-Z0-9]+\)\s*/g, "").trim();
  }

  private formatGlobalDate(date: string): string {
    const value = new Date(`${date}T08:00:00+09:00`);
    const day = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      day: "2-digit",
    }).format(value);
    const month = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      month: "short",
    }).format(value);
    const year = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      year: "numeric",
    }).format(value);
    const weekday = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      weekday: "short",
    }).format(value);
    return `${day}/${month}/${year}(${weekday}) 08:00`;
  }

  private fallbackRoute(route: ScrapedRoute, date: string, reason: string): ScrapedRouteData {
    console.warn(`  Korail live scrape unavailable for ${route.origin} → ${route.destination}: ${reason}. Using fallback data.`);
    return {
      origin: route.origin,
      destination: route.destination,
      date,
      scrapedAt: new Date().toISOString(),
      source: "https://www.korail.com (fallback)",
      results: this.fallbackScrape(route, date),
    };
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private parseTable(html: string): KorailRow[] {
    const rows: KorailRow[] = [];
    const tableRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let match;

    while ((match = tableRegex.exec(html)) !== null) {
      const rowHtml = match[1];
      if (!rowHtml.includes("td") && !rowHtml.includes("th")) continue;

      const cells = rowHtml.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
      if (!cells || cells.length < 3) continue;

      const getCellText = (i: number) =>
        (cells[i] || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

      const cellTexts = cells.map((_, i) => getCellText(i));
      const joined = cellTexts.join(" ");

      if (joined.includes("KTX") || joined.includes("ITX") || joined.includes("무궁화") || joined.includes("새마을")) {
        const trainName = cellTexts[0] || cellTexts[1] || "KTX";
        const departure = cellTexts.find((t) => t.match(/^\d{1,2}:\d{2}/)) || "";
        const departureIdx = cellTexts.findIndex((t) => t.match(/^\d{1,2}:\d{2}/));
        const arrival = departureIdx >= 0 && departureIdx + 1 < cellTexts.length
          ? (cellTexts[departureIdx + 1].match(/\d{1,2}:\d{2}/)?.[0] || "")
          : "";
        const priceText = cellTexts.find((t) => t.includes("원") || t.match(/[\d,]+/)) || "";
        const duration = "";

        if (!departure) continue;

        rows.push({
          trainName,
          departure,
          arrival,
          duration: "",
          price: priceText,
          seatClass: trainName.includes("KTX") || trainName.includes("ITX-") ? "first" : "economy",
        });
      }
    }

    return rows;
  }

  private parseDuration(duration: string): number | undefined {
    const match = duration.match(/(\d+)시간/);
    const minMatch = duration.match(/(\d+)분/);
    if (!match && !minMatch) return undefined;
    const hours = match ? parseInt(match[1]) : 0;
    const mins = minMatch ? parseInt(minMatch[1]) : 0;
    return hours * 60 + mins;
  }

  private parsePrice(price: string): number | undefined {
    const cleaned = price.replace(/,/g, "").replace(/원/g, "").trim();
    const match = cleaned.match(/(\d+)/);
    return match ? parseInt(match[1]) * 1000 : undefined;
  }

  private fallbackScrape(route: ScrapedRoute, date: string) {
    const ktxTravelTimes: Record<string, { hours: number; price: number }> = {
      "Seoul (SNC)-Busan (BSN)": { hours: 2, price: 59800 },
      "Seoul (SNC)-Mokpo": { hours: 3, price: 53300 },
      "Seoul (SNC)-Gangneung": { hours: 2, price: 39600 },
      "Seoul (SNC)-Yeosu-EXPO": { hours: 3, price: 49600 },
      "Seoul (SNC)-Daejeon": { hours: 1, price: 24000 },
      "Seoul (SNC)-Gwangju-Songjeong": { hours: 2, price: 46200 },
      "Busan (BSN)-Seoul (SNC)": { hours: 2, price: 59800 },
      "Daejeon-Busan (BSN)": { hours: 1, price: 37000 },
      "Yongsan-Mokpo": { hours: 3, price: 53300 },
    };

    const key = `${route.origin}-${route.destination}`;
    const info = ktxTravelTimes[key];
    const results = [];

    if (info) {
      for (let h = 6; h <= 22; h += 2) {
        results.push({
          id: `kr-${key}-${h}`,
          country: "korea" as const,
          operator: "Korail",
          service: `KTX ${String(100 + (h - 6) / 2).padStart(3, "0")}`,
          departureTime: `${String(h).padStart(2, "0")}:00`,
          arrivalTime: `${String((h + info.hours) % 24).padStart(2, "0")}:00`,
          durationMinutes: info.hours * 60,
          price: info.price,
          currency: "KRW" as const,
          origin: route.origin,
          destination: route.destination,
          direct: true,
          seatClass: "first" as const,
          stops: [route.origin, route.destination],
        });
      }
    }

    return results;
  }
}
