import { useEffect, useRef, useState } from "react";
import type { AffiliateOffer } from "../server/affiliates";
import { postAuditEvent, resolveAuditTimezone } from "../utils/audit";

const PLACEMENT = "search";

function recordAffiliateEvent(event: "affiliate_impression" | "affiliate_click", offer: AffiliateOffer) {
  void postAuditEvent({
    event,
    affiliateId: offer.id,
    placement: PLACEMENT,
    partner: offer.partner,
    sponsored: offer.sponsored,
  }, { language: navigator.language, timezone: resolveAuditTimezone() });
}

/** Shared-database affiliate carousel for both empty and completed searches. */
export function AffiliateMarquee() {
  const [offers, setOffers] = useState<AffiliateOffer[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const seenOfferIds = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/transit/affiliates")
      .then((response) => response.ok ? response.json() : { offers: [] })
      .then((payload: { offers?: AffiliateOffer[] }) => {
        if (!cancelled) setOffers(Array.isArray(payload.offers) ? payload.offers : []);
      })
      .catch(() => {
        if (!cancelled) setOffers([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || offers.length === 0 || !("IntersectionObserver" in window)) return;
    const byId = new Map(offers.map((offer) => [offer.id, offer]));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = (entry.target as HTMLElement).dataset.affiliateId;
        const offer = id ? byId.get(id) : undefined;
        if (!offer || seenOfferIds.current.has(offer.id)) continue;
        seenOfferIds.current.add(offer.id);
        recordAffiliateEvent("affiliate_impression", offer);
      }
    }, { threshold: 0.5 });
    container.querySelectorAll<HTMLElement>("[data-affiliate-id]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [offers]);

  if (offers.length === 0) return null;
  const repeatedOffers = [...offers, ...offers];

  return (
    <aside aria-label="合作推廣" className="mx-auto w-full max-w-3xl px-4 pb-28 pt-5">
      <div className="overflow-hidden rounded-2xl border border-sky-100 bg-sky-50/70 py-2 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/20">
        <div className="flex items-center gap-2 px-3 pb-1.5 text-[10px] font-bold text-sky-800 dark:text-sky-200">
          <span className="rounded-full bg-sky-600 px-2 py-0.5 text-white">合作推廣</span>
          <span>部分連結為聯盟推廣；點擊可能為本站帶來佣金。</span>
        </div>
        <div ref={containerRef} className="group relative flex overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-sky-50/90 to-transparent dark:from-sky-950/90" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-sky-50/90 to-transparent dark:from-sky-950/90" />
          <div className="flex shrink-0 animate-marquee-left whitespace-nowrap motion-reduce:animate-none group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]">
            {repeatedOffers.map((offer, index) => (
              <a
                key={`${offer.id}-${index}`}
                data-affiliate-id={offer.id}
                href={offer.url}
                target="_blank"
                rel="sponsored nofollow noopener noreferrer"
                onClick={() => recordAffiliateEvent("affiliate_click", offer)}
                className="mx-1.5 inline-flex shrink-0 items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-left text-xs text-slate-700 transition hover:border-sky-400 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:border-sky-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-600 dark:hover:bg-slate-800"
              >
                <span className="font-bold text-slate-900 dark:text-white">{offer.title}</span>
                {offer.partner ? <span className="text-slate-500 dark:text-slate-400">· {offer.partner}</span> : null}
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{offer.description}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
