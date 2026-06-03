import { describe, it, expect } from "vitest";
import { outcomesToCsv } from "./csv";

describe("outcomesToCsv", () => {
  it("emits the header and one row per outcome", () => {
    const csv = outcomesToCsv([
      { outcome: "RESOLVED", count: 99, percentage: 18.86 },
      { outcome: "TRANSFERRED", count: 143, percentage: 27.24 },
    ]);
    const [header, r1, r2] = csv.split("\n");
    expect(header).toBe("outcome,count,percentage");
    expect(r1).toBe("RESOLVED,99,18.86");
    expect(r2).toBe("TRANSFERRED,143,27.24");
  });

  it("quotes outcomes that contain a comma", () => {
    const csv = outcomesToCsv([
      { outcome: "RESOLVED, ALT", count: 1, percentage: 0.1 },
    ]);
    expect(csv).toContain('"RESOLVED, ALT"');
  });

  it("returns only the header for an empty list", () => {
    expect(outcomesToCsv([])).toBe("outcome,count,percentage");
  });
});
