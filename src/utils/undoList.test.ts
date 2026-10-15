import { describe, expect, it } from "vitest";
import { restoreRemoved, takeRemoved } from "./undoList";

const items = (...ids: string[]) => ids.map((id) => ({ id }));

describe("undo list", () => {
  it("puts a removed item back at its old position", () => {
    const list = items("a", "b", "c");
    const removed = takeRemoved(list, (item) => item.id === "b");
    const after = list.filter((item) => item.id !== "b");
    expect(restoreRemoved(after, removed)).toEqual(items("a", "b", "c"));
  });

  it("restores a cleared list in order", () => {
    const list = items("a", "b", "c");
    expect(restoreRemoved([], takeRemoved(list, () => true))).toEqual(list);
  });

  it("keeps what was added since the removal", () => {
    const removed = takeRemoved(items("a", "b"), (item) => item.id === "a");
    expect(restoreRemoved(items("new", "b"), removed)).toEqual(items("a", "new", "b"));
  });

  it("does not duplicate an item that is already back", () => {
    const removed = takeRemoved(items("a", "b"), (item) => item.id === "a");
    expect(restoreRemoved(items("a", "b"), removed)).toEqual(items("a", "b"));
  });

  it("clamps a position past the end of a shorter list", () => {
    const removed = takeRemoved(items("a", "b", "c", "d"), (item) => item.id === "d");
    expect(restoreRemoved(items("a"), removed)).toEqual(items("a", "d"));
  });
});
