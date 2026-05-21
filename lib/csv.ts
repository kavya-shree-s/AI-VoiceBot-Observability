import Papa from "papaparse";
import type { CsvRow } from "./types";

const HEADER_MAP: Record<string, keyof CsvRow> = {
  "Lead ID": "leadId",
  "Call ID": "callId",
  Template: "template",
  Name: "name",
  "Mobile Number": "mobile",
  "Start Time": "startTime",
  "End Time": "endTime",
  Duration: "duration",
  Outcome: "outcome",
  "Metadata Outcome": "metadata",
  "Attempt Count": "attemptCount",
  Record: "record",
};

export function parseCsv(text: string): { rows: CsvRow[]; errors: string[] } {
  const errors: string[] = [];
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (result.errors && result.errors.length > 0) {
    for (const e of result.errors) errors.push(`Row ${e.row}: ${e.message}`);
  }
  const rows: CsvRow[] = result.data.map((raw) => {
    const row = {
      leadId: "",
      callId: "",
      template: "",
      name: "",
      mobile: "",
      startTime: "",
      endTime: "",
      duration: "",
      outcome: "",
      metadata: "",
      attemptCount: "",
      record: "",
    } as CsvRow;
    for (const [csvKey, fieldKey] of Object.entries(HEADER_MAP)) {
      const v = raw[csvKey];
      if (typeof v === "string") row[fieldKey] = v.trim();
    }
    return row;
  });
  return { rows, errors };
}
