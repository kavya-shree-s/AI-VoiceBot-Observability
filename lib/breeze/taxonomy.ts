import { PARAMETERS } from "../evaluation";

export type TaxonomyEntry = { value: string; label: string; group: string };

/** The existing evaluation vocabulary, so insight findings tag failure modes
 *  with known labels (hallucination, section_sequencing, …) not invented ones. */
export function failureModeTaxonomy(): TaxonomyEntry[] {
  return PARAMETERS.map((p) => ({ value: p.value, label: p.label, group: p.group }));
}
