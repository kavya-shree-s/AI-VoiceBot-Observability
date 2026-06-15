export type ReasonCategory = { category: string; details: string[] };
export type Taxonomy = ReasonCategory[];

/** Used when a transcript cannot be fetched or classified. */
export const UNCLASSIFIED = {
  category: "UNCLASSIFIED",
  detail: "Could not classify",
};

// Seeded verbatim from Transferred_call_analysis_2026-06-11.xlsx.
const DRIVER_RIDES_BLOCK_SUPPORT: Taxonomy = [
  {
    category: "TEST_RIDE_VERIFY_FAILED",
    details: [
      "Test-ride failed: notification not received",
      "Test-ride failed: GPS/location off",
      "Test-ride failed: driver offline",
      "Test-ride failed: driver on ride",
    ],
  },
  { category: "OUT_OF_SCOPE", details: ["Out-of-scope query"] },
  { category: "RIDES_UNRESOLVED", details: ["Rides still not coming after troubleshooting"] },
  { category: "TECH_ERROR", details: ["Technical / API error"] },
  { category: "OTHER_ESCALATION", details: ["Other / early human demand"] },
  { category: "BLOCK_UNBLOCK", details: ["Account block / unblock request"] },
];

const BY_TEMPLATE: Record<string, Taxonomy> = {
  "driver-rides-block-support": DRIVER_RIDES_BLOCK_SUPPORT,
};

const DEFAULT_TAXONOMY: Taxonomy = DRIVER_RIDES_BLOCK_SUPPORT;

export function taxonomyFor(template: string): Taxonomy {
  return BY_TEMPLATE[template] ?? DEFAULT_TAXONOMY;
}

export function isValidLabel(tax: Taxonomy, category: string, detail: string): boolean {
  const c = tax.find((x) => x.category === category);
  return !!c && c.details.includes(detail);
}

/** Flat list of every allowed detail across categories (for the classifier enum). */
export function flatDetails(tax: Taxonomy): string[] {
  return tax.flatMap((c) => c.details);
}
