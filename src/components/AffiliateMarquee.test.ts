import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AffiliateMarquee } from "./AffiliateMarquee";

describe("AffiliateMarquee", () => {
  it("lists every approved travel partner as disclosed sponsored links", () => {
    const markup = renderToStaticMarkup(createElement(AffiliateMarquee));

    for (const merchant of ["Klook", "KKday", "Trip.com", "TOCOO! 日本租車網", "JOYTEL 卓一電訊", "colatour 可樂旅遊"]) {
      expect(markup).toContain(merchant);
    }
    expect(markup).toContain("活動 2328｜4% CPS｜30 天 Cookie");
    expect(markup).toContain("活動 6788｜5.5% CPS｜30 天 Cookie");
    expect(markup).toContain("rel=\"sponsored nofollow noopener noreferrer\"");
    expect(markup).toContain("blog.affiliates.one/zh-TW/blog/post/klook-affiliate-program");
  });
});
