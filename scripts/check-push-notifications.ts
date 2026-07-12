/**
 * Runs once daily, right after the scrape job commits fresh timetable data
 * (see .github/workflows/scrape.yml). For every saved push subscription, it
 * re-checks each watched route against the just-updated scraped data and
 * sends a Web Push notification when the canonical-day timetable changed
 * since the last check — reusing the same fingerprint/diff logic the app
 * uses client-side for the "Timetable updated" alert (src/utils/timetableChanges.ts).
 *
 * A no-op (exit 0) when DATABASE_URL or the VAPID keys aren't configured, so
 * this step never fails the scrape workflow for deployments that don't use push.
 */
import "dotenv/config";
import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { pushSubscriptions, type WatchedRoute } from "../src/db/schema";
import { findScrapedResults, loadScrapedData } from "../src/data/scraped";
import { providerDateValue } from "../src/data/countries";
import { describeFingerprintChange, timetableFingerprint } from "../src/utils/timetableChanges";
import type { Country } from "../src/types";

async function main() {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:noreply@example.com";

  if (!process.env.DATABASE_URL || !vapidPublicKey || !vapidPrivateKey) {
    console.log("[push] DATABASE_URL / VAPID keys not configured — skipping push check.");
    return;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  loadScrapedData();

  const subscriptions = await db.select().from(pushSubscriptions);
  console.log(`[push] Checking ${subscriptions.length} subscription(s).`);

  let notified = 0;
  let removed = 0;

  for (const subscription of subscriptions) {
    const isChinese = (subscription.language || "").toLowerCase().startsWith("zh");
    const watchedRoutes = (subscription.watchedRoutes || []) as WatchedRoute[];
    const changedRoutes: { route: WatchedRoute; message: string; nextFingerprint: WatchedRoute["fingerprint"] }[] = [];
    const unchangedRoutes: WatchedRoute[] = [];

    for (const route of watchedRoutes) {
      const today = providerDateValue(route.country as Country);
      const results = findScrapedResults(route.country as Country, route.origin, route.destination, today);
      const nextFingerprint = results ? timetableFingerprint(results) : undefined;

      const message = nextFingerprint && route.fingerprint
        ? describeFingerprintChange(route.fingerprint, nextFingerprint, isChinese)
        : undefined;

      if (message) {
        changedRoutes.push({ route, message, nextFingerprint });
      } else {
        unchangedRoutes.push({ ...route, fingerprint: nextFingerprint ?? route.fingerprint });
      }
    }

    // Only advance a changed route's stored fingerprint once its notification has
    // actually gone out — otherwise a transient send failure would silently drop
    // the change forever instead of being retried on the next run.
    let notificationDelivered = false;
    let subscriptionRemoved = false;

    if (changedRoutes.length > 0) {
      const title = isChinese ? "時刻表已更新" : "Timetable updated";
      const body = changedRoutes.length === 1
        ? `${changedRoutes[0].route.origin} → ${changedRoutes[0].route.destination}: ${changedRoutes[0].message}`
        : (isChinese
          ? `${changedRoutes.length} 條收藏路線的時刻表已變動。`
          : `${changedRoutes.length} of your saved routes changed.`);

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dhKey, auth: subscription.authKey },
          },
          JSON.stringify({ title, body }),
        );
        notified += 1;
        notificationDelivered = true;
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, subscription.endpoint));
          removed += 1;
          subscriptionRemoved = true;
        } else {
          console.warn(`[push] Failed to notify ${subscription.endpoint.slice(0, 40)}...:`, error?.message || error);
        }
      }
    }

    if (subscriptionRemoved) continue;

    const nextWatchedRoutes = [
      ...unchangedRoutes,
      ...changedRoutes.map(({ route, nextFingerprint }) => ({
        ...route,
        fingerprint: notificationDelivered ? (nextFingerprint ?? route.fingerprint) : route.fingerprint,
      })),
    ];

    await db
      .update(pushSubscriptions)
      .set({ watchedRoutes: nextWatchedRoutes, updatedAt: new Date() })
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
  }

  console.log(`[push] Done. Notified ${notified} subscription(s), removed ${removed} stale subscription(s).`);
}

main().catch((error) => {
  console.error("[push] Check run failed:", error);
  process.exitCode = 1;
});
