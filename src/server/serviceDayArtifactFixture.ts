/**
 * Test helper for the service-day advisory suites (France, Thailand).
 *
 * Those suites need "no artifact on disk" as a starting state, and they reached
 * it by deleting `src/data/service-day/<country>.json` — a file that is
 * committed to the repository. Deleting it outright had two consequences: every
 * run left the working tree dirty, and the suite only passed because an earlier
 * run had already removed the file, so a clean checkout failed.
 *
 * This stashes the committed contents for the duration of the suite and puts
 * them back afterwards, keeping the original intent (each test starts without
 * an artifact) without destroying tracked data.
 *
 * Not named *.test.ts on purpose — vitest.config.ts only collects that pattern.
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

export function serviceDayArtifactFixture(artifactUrl: URL) {
  let tracked: string | undefined;
  const remove = () => {
    if (existsSync(artifactUrl)) unlinkSync(artifactUrl);
  };

  return {
    /** Stash the committed artifact, then start the suite from a clean slate. */
    stash() {
      tracked = existsSync(artifactUrl) ? readFileSync(artifactUrl, "utf8") : undefined;
      remove();
    },
    /** Drop whatever the last test wrote, so tests stay independent. */
    clear: remove,
    /** Put the committed artifact back so the working tree ends up clean. */
    restore() {
      remove();
      if (tracked !== undefined) writeFileSync(artifactUrl, tracked);
    },
  };
}
