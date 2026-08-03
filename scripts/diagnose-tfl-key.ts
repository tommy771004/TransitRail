/**
 * Ask TfL one question and print exactly what it says back.
 *
 * A 429 from the scrape is ambiguous: too many requests, an exhausted quota and
 * a key that is not subscribed to a product all arrive as the same status. One
 * request answers it — if a single call with an idle key still returns 429, no
 * amount of pacing will help and the subscription is what needs attention.
 *
 *   npx tsx scripts/diagnose-tfl-key.ts
 */

const TFL_API_URL = "https://api.tfl.gov.uk";

function describeKey(key: string | undefined) {
  if (!key) return "not set (requests will go out anonymously)";
  const trimmed = key.trim();
  const notes: string[] = [`length ${key.length}`];
  if (trimmed !== key) notes.push("HAS SURROUNDING WHITESPACE — likely a stray newline or space");
  if (/^["'].*["']$/.test(trimmed)) notes.push('IS WRAPPED IN QUOTES — the quotes are part of the value and TfL will reject it');
  return `${key.slice(0, 4)}…${key.slice(-2)} (${notes.join("; ")})`;
}

async function probe(label: string, url: URL) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "TransitRail/1.0" },
    });
    const body = (await response.text()).replace(/\s+/g, " ").trim();
    console.log(`\n${label}`);
    console.log(`  HTTP ${response.status} in ${Date.now() - started}ms`);
    for (const header of ["retry-after", "x-ratelimit-limit", "x-ratelimit-remaining", "ratelimit-remaining"]) {
      const value = response.headers.get(header);
      if (value) console.log(`  ${header}: ${value}`);
    }
    console.log(`  body: ${body.slice(0, 300) || "<empty>"}`);
    return response.status;
  } catch (error) {
    console.log(`\n${label}\n  request failed: ${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }
}

async function main() {
  const key = process.env.TFL_APP_KEY;
  console.log(`TFL_APP_KEY: ${describeKey(key)}`);

  const anonymous = new URL("/StopPoint/Search/Oxford%20Circus", TFL_API_URL);
  anonymous.searchParams.set("modes", "tube");
  const anonymousStatus = await probe("Without a key (baseline for this IP)", anonymous);

  let keyedStatus: number | undefined;
  if (key) {
    const keyed = new URL(anonymous);
    keyed.searchParams.set("app_key", key);
    keyedStatus = await probe("With TFL_APP_KEY", keyed);
  }

  console.log("\nReading:");
  if (keyedStatus === 200) {
    console.log("  The key works. A 429 during a scrape is then about rate, not validity —");
    console.log("  raise TFL_REQUEST_INTERVAL_MS until it clears.");
  } else if (keyedStatus === 429) {
    console.log("  A single idle request was rejected, so the scrape is not what exhausted it.");
    console.log("  Check the portal: is the subscription approved and on a product with a");
    console.log("  per-minute allowance, and is its quota still available?");
  } else if (keyedStatus && keyedStatus >= 400) {
    console.log(`  The key was rejected outright (HTTP ${keyedStatus}). Compare the value above`);
    console.log("  against the portal — quotes and trailing newlines are the usual cause.");
  } else if (!key) {
    console.log(`  No key was set; anonymous access returned HTTP ${anonymousStatus}.`);
    console.log("  A 429 here means this IP's anonymous allowance is already spent — on a");
    console.log("  shared CI runner that can happen without this project doing anything.");
  }
}

void main();
