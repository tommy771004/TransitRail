import { BaseScraper } from "./base";
import { koreaStationToKorean } from "./stationMaps";
import { koreaRoutes } from "./routes";
import type { ScrapedRoute, ScrapedRouteData } from "./types";
import type { Page } from "playwright";

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
      // Letskorail requires a session cookie first
      await page.goto("https://www.letskorail.com", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(2000);

      // Navigate to ticket search page
      await page.goto("https://www.letskorail.com/ebizbf/EbizBfTicketSearch.do", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(1000);

      // Fill the search form
      const originInput = await page.$("#start");
      const destInput = await page.$("#end");

      if (originInput && destInput) {
        await originInput.fill(originKo);
        await destInput.fill(destKo);
      } else {
        throw new Error("Korail search form not found (selectors may have changed)");
      }

      // Set date
      const dateInput = await page.$('input[name="selGoYear"]');
      if (dateInput) {
        await dateInput.fill(y);
      }
      const monthInput = await page.$('input[name="selGoMonth"]');
      if (monthInput) {
        await monthInput.fill(m);
      }
      const dayInput = await page.$('input[name="selGoDay"]');
      if (dayInput) {
        await dayInput.fill(d);
      }

      // Submit
      const submitBtn = await page.$('input[type="submit"], button[type="submit"], a.imgBtn');
      if (submitBtn) {
        await submitBtn.click();
      } else {
        throw new Error("Korail submit button not found");
      }

      await page.waitForTimeout(5000);

      // Parse results table
      const html = await page.content();
      const rows = this.parseTable(html);

      if (rows.length === 0) {
        console.warn(`  No results parsed from Korail for ${route.origin} → ${route.destination}, using fallback`);
        return {
          origin: route.origin,
          destination: route.destination,
          date,
          scrapedAt: new Date().toISOString(),
          source: "https://www.letskorail.com (fallback)",
          results: this.fallbackScrape(route, date),
        };
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
      console.warn(`  Korail scrape failed, using fallback data:`, error);
      const fallbackResults = this.fallbackScrape(route, date);
      return {
        origin: route.origin,
        destination: route.destination,
        date,
        scrapedAt: new Date().toISOString(),
        source: "https://www.letskorail.com (fallback)",
        results: fallbackResults,
      };
    }
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
          arrivalTime: `${String(h + info.hours).padStart(2, "0")}:00`,
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
