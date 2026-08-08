const affiliateOffers = [
  {
    merchant: "Klook",
    category: "全球景點、票券、交通、旅遊服務",
    terms: "活動 2328｜4% CPS｜30 天 Cookie",
    url: "https://blog.affiliates.one/zh-TW/blog/post/klook-affiliate-program",
  },
  {
    merchant: "KKday",
    category: "全球體驗、票券、包車、機場接送",
    terms: "活動 1809｜3.5% CPS｜30 天 Cookie｜52 國／170 城",
    url: "https://blog.affiliates.one/zh-TW/blog/post/kkday-affiliate-program",
  },
  {
    merchant: "Trip.com",
    category: "機票、飯店、旅遊服務",
    terms: "活動 2226｜4.2% CPS｜30 天 Cookie",
    url: "https://blog.affiliates.one/zh-TW/blog/post/trip-dot-com-affiliate-program",
  },
  {
    merchant: "TOCOO! 日本租車網",
    category: "日本租車",
    terms: "近期新合作商家｜適合日本路線搜尋後推薦",
    url: "https://blog.affiliates.one/zh-TW/blog?page=6",
  },
  {
    merchant: "JOYTEL 卓一電訊",
    category: "出國上網卡／eSIM",
    terms: "活動 5884｜7% CPS｜30 天 Cookie",
    url: "https://blog.affiliates.one/zh-TW/blog/post/joytel-zhuo-dian-xun-tai-wan-affiliate-program",
  },
  {
    merchant: "colatour 可樂旅遊",
    category: "機票、住宿、票券、交通票券、網卡",
    terms: "活動 6788｜5.5% CPS｜30 天 Cookie",
    url: "https://blog.affiliates.one/zh-TW/blog/post/colatour-affiliate-program",
  },
] as const;

/** Always-visible disclosure and partner carousel below the journey search. */
export function AffiliateMarquee() {
  const repeatedOffers = [...affiliateOffers, ...affiliateOffers];

  return (
    <aside
      aria-label="合作推廣"
      className="mx-auto w-full max-w-3xl px-4 pb-28 pt-5"
    >
      <div className="overflow-hidden rounded-2xl border border-sky-100 bg-sky-50/70 py-2 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/20">
        <div className="flex items-center gap-2 px-3 pb-1.5 text-[10px] font-bold text-sky-800 dark:text-sky-200">
          <span className="rounded-full bg-sky-600 px-2 py-0.5 text-white">合作推廣</span>
          <span>部分連結為聯盟推廣；點擊可能為本站帶來佣金。</span>
        </div>
        <div className="group relative flex overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-sky-50/90 to-transparent dark:from-sky-950/90" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-sky-50/90 to-transparent dark:from-sky-950/90" />
          <div className="flex shrink-0 animate-marquee-left whitespace-nowrap motion-reduce:animate-none group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]">
            {repeatedOffers.map((offer, index) => (
              <a
                key={`${offer.merchant}-${index}`}
                href={offer.url}
                target="_blank"
                rel="sponsored nofollow noopener noreferrer"
                className="mx-1.5 inline-flex shrink-0 items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-left text-xs text-slate-700 transition hover:border-sky-400 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:border-sky-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-600 dark:hover:bg-slate-800"
              >
                <span className="font-bold text-slate-900 dark:text-white">{offer.merchant}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500 dark:text-slate-400">{offer.category}</span>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{offer.terms}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
