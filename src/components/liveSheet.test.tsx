import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "../i18n";
import { LiveSheet } from "./LiveSheet";

beforeAll(async () => { await i18n.changeLanguage("en"); });

const sheet = (updatedAt: string | undefined, refreshing: boolean) => renderToStaticMarkup(
  <LiveSheet
    country="hong_kong"
    titleId="t"
    title="Board"
    updatedAt={updatedAt}
    timeZone="Asia/Hong_Kong"
    onRefresh={() => {}}
    refreshing={refreshing}
    onClose={() => {}}
    footer={null}
  >
    <p>body</p>
  </LiveSheet>,
);

describe("live sheet refresh", () => {
  it("is an icon button that names the last update on the market clock", () => {
    const html = sheet("2026-10-15T06:00:32Z", false);
    expect(html).toContain('aria-label="Refresh · Updated 14:00:32"');
    expect(html).toContain('title="Updated 14:00:32"');
    expect(html).not.toContain("Every 30");
  });

  it("spins and refuses a second press while a read is in flight", () => {
    const html = sheet(undefined, true);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Refresh"/);
    expect(html).toContain("animate-spin");
  });
});
