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
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
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
    <section
      className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] overflow-hidden"
      style={{ borderRadius: "var(--radius-lg)" }}
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)] flex-wrap">
        <div className="min-w-0">
          <h3 className="text-h2">Outcomes</h3>
          {data && (
            <p className="text-caption text-[var(--muted)]">
              {data.pagination.total.toLocaleString()} outcomes ·{" "}
              {data.page_total_calls.toLocaleString()} calls on this page
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--muted-2)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search outcomes…"
              className="pl-6 pr-2 py-1.5 rounded-[7px] border border-[var(--border)] bg-[var(--surface-muted)] text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!data || rows.length === 0}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] border border-[var(--border)] text-[12px] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 transition"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
        </div>
      </header>

      {isLoading && <div className="px-4 py-3"><Loading label="Loading…" /></div>}
      {error && <div className="px-4 py-3"><ErrorBox message={(error as Error).message} /></div>}
      {!isLoading && !error && rows.length === 0 && (
        <div className="px-4 py-3"><EmptyBox label={query ? "No outcomes match the search." : "No data."} /></div>
      )}
      {!isLoading && !error && rows.length > 0 && data && (
        <>
          <div className="max-h-[480px] overflow-y-auto">
            <table className="min-w-full text-[13px]">
              <thead className="sticky top-0 z-10 bg-[var(--surface)]">
                <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--muted)]">
                  <Th onClick={() => toggleSort("outcome")} active={sortKey === "outcome"} dir={sortDir}>Outcome</Th>
                  <Th onClick={() => toggleSort("count")} active={sortKey === "count"} dir={sortDir}>Count</Th>
                  <Th onClick={() => toggleSort("percentage")} active={sortKey === "percentage"} dir={sortDir}>Percentage</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.outcome}
                    className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)]"
                  >
                    <td className="px-3 py-2 font-mono text-[11px]">{r.outcome}</td>
                    <td className="px-3 py-2 tabular-nums">{r.count.toLocaleString()}</td>
                    <td className="px-3 py-2 tabular-nums">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-1.5 w-16 rounded-full bg-[var(--surface-muted)] overflow-hidden"
                          aria-hidden="true"
                        >
                          <div
                            className="h-full bg-[var(--accent)] rounded-full"
                            style={{
                              width: `${Math.min(100, r.percentage)}%`,
                            }}
                          />
                        </div>
                        <span>{r.percentage.toFixed(2)}%</span>
                      </div>
                    </td>
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
    <th className="px-3 py-2 font-medium border-b border-[var(--border)] bg-[var(--surface)]">
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
    <div className="flex items-center justify-end gap-2 px-4 py-2 text-[11px] text-[var(--muted)] border-t border-[var(--border)]">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="px-2 py-1 rounded-[6px] border border-[var(--border)] hover:border-[var(--border-strong)] disabled:opacity-40"
      >
        Prev
      </button>
      <span className="tabular-nums">{page} / {totalPages}</span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="px-2 py-1 rounded-[6px] border border-[var(--border)] hover:border-[var(--border-strong)] disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
