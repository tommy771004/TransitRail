import { describe, expect, it } from "vitest";
import { tripCardMotion } from "./ResultShell";

describe("tripCardMotion", () => {
  it("fades each result card in once as it enters the viewport", () => {
    const motion = tripCardMotion(10);

    expect(motion.initial).toEqual({ opacity: 0 });
    expect(motion.whileInView).toEqual({ opacity: 1 });
    expect(motion.viewport).toEqual({ once: true, amount: 0.12, margin: "0px 0px -32px 0px" });
    expect(motion.transition).toMatchObject({ duration: 0.3 });
    expect((motion.transition as { delay: number }).delay).toBeCloseTo(0.105);
  });
});
