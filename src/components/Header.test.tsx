import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import "../i18n";
import { Header } from "./Header";

describe("Header background appearance", () => {
  it("uses 40% background opacity in both themes without fading the entire header", () => {
    const html = renderToStaticMarkup(
      <Header
        onMenuOpen={vi.fn()}
        onProfileOpen={vi.fn()}
        timezone="Asia/Taipei"
        homeCurrency="TWD"
      />,
    );
    const classes = html.match(/<header class="([^"]+)"/)?.[1].split(/\s+/);
    expect(classes).toBeDefined();
    expect(classes).toContain("bg-white/40");
    expect(classes).toContain("dark:bg-[#060a13]/40");
    expect(classes).not.toContain("bg-white");
    expect(classes).not.toContain("dark:bg-[#060a13]");
    expect(classes?.some((name) => /(^|:)opacity-/.test(name))).toBe(false);
  });
});
