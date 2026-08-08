import { neon } from "@neondatabase/serverless";

export type AffiliateOffer = {
  id: string;
  sponsored: boolean;
  title: string;
  description: string;
  ctaLabel: string;
  url: string;
  icon?: string;
  categories: string[];
  crops: string[];
  priority: number;
  partner?: string;
};

type AffiliateRow = Partial<AffiliateOffer> & { enabled?: boolean };

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function publicUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Validate externally maintained offers before making them browser-visible. */
export function selectAffiliateOffers(rows: readonly AffiliateRow[], limit = 6): AffiliateOffer[] {
  return rows.flatMap((row) => {
    const url = publicUrl(row.url);
    if (!row.enabled || !url || typeof row.id !== "string" || typeof row.title !== "string"
      || typeof row.description !== "string" || typeof row.ctaLabel !== "string") return [];
    return [{
      id: row.id,
      sponsored: Boolean(row.sponsored),
      title: row.title,
      description: row.description,
      ctaLabel: row.ctaLabel,
      url,
      ...(typeof row.icon === "string" ? { icon: row.icon } : {}),
      categories: stringArray(row.categories),
      crops: stringArray(row.crops),
      priority: typeof row.priority === "number" && Number.isFinite(row.priority) ? row.priority : 0,
      ...(typeof row.partner === "string" ? { partner: row.partner } : {}),
    }].filter((offer) => offer.categories.includes("all"));
  })
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id))
    .slice(0, limit);
}

/**
 * Read the shared, externally maintained affiliate table. There is
 * deliberately no in-code fallback: an unset or unavailable integration must
 * hide the placement instead of publishing stale or untracked offers.
 */
export async function getAffiliateOffers(limit = 6): Promise<AffiliateOffer[]> {
  const databaseUrl = process.env.SUP_DATABASE_URL;
  const projectName = process.env.AFFILIATE_PROJECT_NAME;
  if (!databaseUrl || !projectName) return [];

  const sql = neon(databaseUrl);
  const rows = await sql`
    SELECT id, enabled, sponsored, title, description, cta_label AS "ctaLabel",
      url, icon, categories, crops, priority, partner
    FROM affiliates
    WHERE project_name = ${projectName} AND enabled = true
  `;
  return selectAffiliateOffers(rows as AffiliateRow[], limit);
}
