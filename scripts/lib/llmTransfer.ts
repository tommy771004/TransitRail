/**
 * LLM gap-filler for transfer routing the static topology can't resolve
 * (branch stations, cross-network interchanges with different names, or
 * networks with no static line data). Uses the repo's resilient free-model
 * caller (src/openRouterHelper.ts) — it walks a list of free OpenRouter models
 * until one returns output that passes the validator.
 *
 * This is an AUTHORING-TIME aid, never part of the daily scrape: it only runs
 * when OPENROUTER_API_KEY is set, and its output is validated against the
 * caller-supplied station list so a hallucinated interchange is rejected (→
 * next model) rather than written to disk. Callers must keep a curated fallback
 * for when no key is present or every model fails.
 */
import { fetchOpenRouterWithFallback } from "../../src/openRouterHelper";

export interface LlmTransferPlan {
  interchange: string;
  leg1Line: string;
  leg2Line: string;
  leg1Min: number;
  transferMin: number;
  leg2Min: number;
}

const norm = (s: string) => s.toLowerCase().trim();

/**
 * Ask the free-model pool to route origin→destination via a single realistic
 * interchange. `stationList` is that network's real station names; the
 * interchange must be one of them and must differ from origin/destination, or
 * the answer is rejected. Returns null if no key, no valid answer, or the leg
 * minutes don't add up to `expectedTotalMin` (± tolerance).
 */
export async function llmResolveTransfer(
  country: string,
  origin: string,
  destination: string,
  stationList: string[],
  expectedTotalMin: number,
): Promise<LlmTransferPlan | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const stationSet = new Set(stationList.map(norm));
  const system =
    "You are a public-transit routing expert. Given an origin and destination on a metro/rail network, " +
    "return the single most reasonable interchange and the two legs. Respond with ONLY minified JSON, no prose. " +
    'Schema: {"interchange":string,"leg1Line":string,"leg2Line":string,"leg1Min":number,"transferMin":number,"leg2Min":number}. ' +
    "The interchange MUST be an exact name from the provided station list, must be geographically between origin and destination, " +
    "and leg1Min+transferMin+leg2Min must roughly equal the total minutes given.";
  const user = JSON.stringify({
    country,
    origin,
    destination,
    approxTotalMinutes: expectedTotalMin,
    stationList,
  });

  const validate = (text: string): string => {
    const parsed = JSON.parse(text);
    const plan = parsed as LlmTransferPlan;
    if (!plan || typeof plan.interchange !== "string") throw new Error("missing interchange");
    if (!stationSet.has(norm(plan.interchange))) throw new Error(`interchange "${plan.interchange}" not in station list`);
    if (norm(plan.interchange) === norm(origin) || norm(plan.interchange) === norm(destination)) throw new Error("interchange equals origin/destination");
    const sum = Number(plan.leg1Min) + Number(plan.transferMin) + Number(plan.leg2Min);
    if (!Number.isFinite(sum) || Math.abs(sum - expectedTotalMin) > Math.max(10, expectedTotalMin * 0.4)) {
      throw new Error(`leg minutes ${sum} far from expected ${expectedTotalMin}`);
    }
    return JSON.stringify(plan);
  };

  try {
    const { text, model } = await fetchOpenRouterWithFallback(apiKey, user, validate, undefined, undefined, "openrouter", undefined, undefined, "haiku", system);
    console.log(`  llm-gapfill  ${country} ${origin}→${destination}: resolved by ${model}`);
    return JSON.parse(text) as LlmTransferPlan;
  } catch (error) {
    console.warn(`  llm-gapfill  ${country} ${origin}→${destination}: no valid answer (${error instanceof Error ? error.message : error}); keeping curated`);
    return null;
  }
}
