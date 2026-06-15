import { describe, it, expect } from "vitest";
import { taxonomyFor, isValidLabel, UNCLASSIFIED } from "./reasonTaxonomy";

describe("reasonTaxonomy", () => {
  it("returns the driver-rides-block-support taxonomy with the seeded categories", () => {
    const tax = taxonomyFor("driver-rides-block-support");
    const cats = tax.map((c) => c.category);
    expect(cats).toContain("TEST_RIDE_VERIFY_FAILED");
    expect(cats).toContain("OUT_OF_SCOPE");
    expect(cats).toContain("TECH_ERROR");
    const testRide = tax.find((c) => c.category === "TEST_RIDE_VERIFY_FAILED")!;
    expect(testRide.details).toContain("Test-ride failed: notification not received");
  });

  it("falls back to the default taxonomy for an unknown template", () => {
    expect(taxonomyFor("unknown-template").length).toBeGreaterThan(0);
  });

  it("validates a (category, detail) pairing", () => {
    const tax = taxonomyFor("driver-rides-block-support");
    expect(isValidLabel(tax, "OUT_OF_SCOPE", "Out-of-scope query")).toBe(true);
    expect(isValidLabel(tax, "OUT_OF_SCOPE", "Test-ride failed: driver offline")).toBe(false);
    expect(isValidLabel(tax, "NOT_A_CATEGORY", "x")).toBe(false);
  });

  it("exposes an UNCLASSIFIED bucket for fetch/classify failures", () => {
    expect(UNCLASSIFIED.category).toBe("UNCLASSIFIED");
    expect(typeof UNCLASSIFIED.detail).toBe("string");
  });
});
