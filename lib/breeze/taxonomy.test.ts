import { describe, it, expect } from "vitest";
import { failureModeTaxonomy } from "./taxonomy";

describe("failureModeTaxonomy", () => {
  it("exposes the evaluation parameter vocabulary", () => {
    const tax = failureModeTaxonomy();
    expect(tax.length).toBeGreaterThan(0);
    const values = tax.map((t) => t.value);
    expect(values).toContain("hallucination");
    expect(values).toContain("section_sequencing");
    expect(tax[0]).toHaveProperty("label");
    expect(tax[0]).toHaveProperty("group");
  });
});
