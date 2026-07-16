/**
 * PROTOTYPE — throwaway GSC sitemap probe.
 *
 * Question: "Does production currently satisfy what Google needs to *fetch*
 * the sitemap, or is GSC still seeing the HTTP 500 era?"
 *
 * Run: npx tsx scripts/prototype-gsc-sitemap-check.ts [baseUrl]
 */

const BASE = (process.argv[2] || "https://rail-national.vercel.app").replace(/\/$/, "");

type Check = { name: string; ok: boolean; detail: string };

async function fetchUrl(path: string, ua = "Googlebot/2.1") {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { "User-Agent": ua, Accept: "*/*" },
    redirect: "follow",
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    url,
    status: res.status,
    contentType: res.headers.get("content-type") || "",
    body: buf.toString("utf8"),
    bytes: buf.length,
  };
}

function isXmlSitemap(body: string) {
  const t = body.trimStart();
  return t.startsWith("<?xml") && (t.includes("<urlset") || t.includes("<sitemapindex"));
}

function isHtml(body: string) {
  const t = body.trimStart().toLowerCase();
  return t.startsWith("<!doctype html") || t.startsWith("<html");
}

async function main() {
  console.log("=== PROTOTYPE GSC sitemap check ===");
  console.log("base:", BASE);
  console.log("");

  const checks: Check[] = [];
  const xml = await fetchUrl("/sitemap.xml");
  checks.push({
    name: "GET /sitemap.xml status 200",
    ok: xml.status === 200,
    detail: `HTTP ${xml.status}`,
  });
  checks.push({
    name: "Content-Type is XML (not HTML)",
    ok: /xml/i.test(xml.contentType) && !/html/i.test(xml.contentType),
    detail: xml.contentType,
  });
  checks.push({
    name: "Body is XML urlset/index (not SPA HTML)",
    ok: isXmlSitemap(xml.body) && !isHtml(xml.body),
    detail: isHtml(xml.body) ? "HTML shell" : xml.body.slice(0, 80).replace(/\n/g, " "),
  });
  checks.push({
    name: "Not HTTP 500 (GSC '一般的 HTTP 錯誤')",
    ok: xml.status !== 500,
    detail: `status=${xml.status}`,
  });

  let urlCount = 0;
  if (isXmlSitemap(xml.body)) {
    urlCount = (xml.body.match(/<loc>/g) || []).length;
    checks.push({
      name: "Contains <loc> entries",
      ok: urlCount > 0,
      detail: `${urlCount} locs`,
    });
  }

  const txt = await fetchUrl("/sitemap.txt");
  const txtUrls = txt.body.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("http"));
  checks.push({
    name: "GET /sitemap.txt (plain-text fallback) 200 + URL list",
    ok: txt.status === 200 && !isHtml(txt.body) && txtUrls.length > 0,
    detail: isHtml(txt.body)
      ? "SPA HTML shell (not deployed yet or rewrite)"
      : `HTTP ${txt.status}, urls=${txtUrls.length}`,
  });

  const robots = await fetchUrl("/robots.txt");
  checks.push({
    name: "robots.txt declares Sitemap: …/sitemap.xml",
    ok: robots.body.includes("Sitemap:") && robots.body.includes(`${BASE}/sitemap.xml`),
    detail: robots.body.split("\n").filter((l) => /sitemap/i.test(l)).join(" | ") || "(none)",
  });

  console.log("Results:");
  for (const c of checks) {
    console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
    console.log(`         ${c.detail}`);
  }
  const failed = checks.filter((c) => !c.ok);
  console.log("");
  if (failed.length === 0) {
    console.log("VERDICT: Production is fetchable. GSC '無法讀取' is almost certainly a");
    console.log("         STALE crawl from the HTTP-500 window. Action:");
    console.log("         1) Delete the failed sitemap row in GSC");
    console.log("         2) Re-submit https://…/sitemap.xml");
    console.log("         3) Also try https://…/sitemap.txt as a second entry");
    console.log(`         (${urlCount} URLs in XML right now)`);
  } else {
    console.log("VERDICT: Production still fails GSC prerequisites — fix FAILs above first.");
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
