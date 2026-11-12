import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import "../i18n";
import { Header } from "./Header";

const renderHeader = () => renderToStaticMarkup(
  <Header
    onMenuOpen={vi.fn()}
    pageLabel="Search"
    timezone="Asia/Taipei"
    homeCurrency="TWD"
  />,
);

describe("Header background appearance", () => {
  it("uses 40% background opacity in both themes without fading the entire header", () => {
    const html = renderHeader();
    const classes = html.match(/<header class="([^"]+)"/)?.[1].split(/\s+/);
    expect(classes).toBeDefined();
    expect(classes).toContain("bg-white/40");
    expect(classes).toContain("dark:bg-[#060a13]/40");
    expect(classes).not.toContain("bg-white");
    expect(classes).not.toContain("dark:bg-[#060a13]");
    expect(classes?.some((name) => /(^|:)opacity-/.test(name))).toBe(false);
  });
});

describe("Header language picker", () => {
  it("uses a compact elevated control while keeping the native select", () => {
    const html = renderHeader();
    const classes = html.match(/<select[^>]*class="([^"]+)"/)?.[1].split(/\s+/);
    expect(classes).toBeDefined();
    expect(classes).toContain("h-9");
    expect(classes).toContain("appearance-none");
    expect(classes).toContain("m3-shape-full");
    expect(classes).toContain("m3-elevation-1");
    expect(classes).not.toContain("h-12");
    expect(html.match(/<option/g)).toHaveLength(4);
  });

  it("leaves the language picker to the side menu on phones", () => {
    const html = renderHeader();
    const wrapper = html.match(/<div class="([^"]+)"><select/)?.[1].split(/\s+/);
    expect(wrapper).toContain("hidden");
    expect(wrapper).toContain("md:block");
  });
});

describe("Header compact layout", () => {
  it("names the current page in the market accent", () => {
    const html = renderHeader();
    expect(html).toMatch(/<span aria-hidden="true" class="[^"]*text-accent[^"]*">Search<\/span>/);
  });

  it("opens the side menu from the menu button and the timezone chip, with no profile button", () => {
    const html = renderHeader();
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain("TWD");
  });
});
