import { describe, it, expect } from "vitest";
import { addView, removeView, type SavedView } from "./savedViews";
import type { FiltersState } from "../../app/analytics/store";

const filters: FiltersState = {
  date_from: "2026-06-01",
  date_to: "2026-06-03",
  outcomes: [],
  templates: [],
};

const view = (overrides: Partial<SavedView> = {}): SavedView => ({
  id: "a",
  name: "Week 1",
  filters,
  createdAt: "2026-06-04T10:00:00Z",
  ...overrides,
});

describe("addView", () => {
  it("prepends a new view to the list", () => {
    const out = addView([view({ id: "x", name: "X" })], view({ id: "y", name: "Y" }));
    expect(out.map((v) => v.id)).toEqual(["y", "x"]);
  });

  it("replaces by id when the same id is added again", () => {
    const existing = view({ id: "a", name: "Old" });
    const out = addView([existing], view({ id: "a", name: "New" }));
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("New");
  });
});

describe("removeView", () => {
  it("removes the view with the matching id", () => {
    const out = removeView([view({ id: "a" }), view({ id: "b" })], "a");
    expect(out.map((v) => v.id)).toEqual(["b"]);
  });

  it("is a no-op when the id isn't present", () => {
    const input = [view({ id: "a" })];
    expect(removeView(input, "missing")).toEqual(input);
  });
});
