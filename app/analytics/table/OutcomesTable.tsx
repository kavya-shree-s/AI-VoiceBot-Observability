"use client";

import { useMemo, useState } from "react";
import { Download, ArrowUpDown, Search } from "lucide-react";
import { useOutcomeCounts } from "../hooks";
import { outcomesToCsv } from "@/lib/analytics/csv";
import { Loading, ErrorBox, EmptyBox } from "../States";

type SortKey = "outcome" | "count" | "percentage";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 20;

export function OutcomesTable() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useOutcomeCounts(page, PAGE_SIZE);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? data.results.filter((r) => r.outcome.toLowerCase().includes(q))
      : data.results;
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }
      const an = Number(av);
      const bn = Number(bv);
      return sortDir === "asc" ? an - bn : bn - an;
    });
    return sorted;
  }, [data, query, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "outcome" ? "asc" : "desc");
    }
  };

  const exportCsv = () => {
    if (!data) return;
    const csv = outcomesToCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outcomes_page${page}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h3 className="text-sm font-semibold">Outcomes</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-2)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search outcomes…"
              className="pl-7 pr-2 py-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition"
            />
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!data || rows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border)] text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 transition"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
        </div>
      </div>

      {isLoading && <Loading label="Loading table…" />}
      {error && <ErrorBox message={(error as Error).message} />}
      {!isLoading && !error && rows.length === 0 && (
        <EmptyBox label={query ? "No outcomes match the search." : "No data."} />
      )}
      {!isLoading && !error && rows.length > 0 && data && (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]">
                  <Th onClick={() => toggleSort("outcome")} active={sortKey === "outcome"} dir={sortDir}>Outcome</Th>
                  <Th onClick={() => toggleSort("count")} active={sortKey === "count"} dir={sortDir}>Count</Th>
                  <Th onClick={() => toggleSort("percentage")} active={sortKey === "percentage"} dir={sortDir}>Percentage</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.outcome} className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]">
                    <td className="px-3 py-2 font-mono text-xs">{r.outcome}</td>
                    <td className="px-3 py-2 tabular-nums">{r.count.toLocaleString()}</td>
                    <td className="px-3 py-2 tabular-nums">{r.percentage.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={data.pagination.total_pages}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: SortDir;
}) {
  return (
    <th className="px-3 py-2 font-medium">
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 ${active ? "text-[var(--foreground)]" : ""}`}
      >
        {children}
        <ArrowUpDown
          className={`h-3 w-3 transition ${active ? (dir === "asc" ? "rotate-180" : "") : "opacity-50"}`}
        />
      </button>
    </th>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 mt-3 text-xs text-[var(--muted)]">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--border-strong)] disabled:opacity-40"
      >
        Prev
      </button>
      <span className="tabular-nums">{page} / {totalPages}</span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--border-strong)] disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
