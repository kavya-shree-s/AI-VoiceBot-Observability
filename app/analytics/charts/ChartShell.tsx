"use client";

type Props = {
  title: string;
  subtitle?: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
};

export function ChartShell({ title, subtitle, toolbar, children }: Props) {
  return (
    <section
      className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]"
      style={{ borderRadius: "var(--radius-lg)" }}
    >
      <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-2 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-h2 truncate">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-caption text-[var(--muted)]">{subtitle}</p>
          )}
        </div>
        {toolbar && <div className="shrink-0">{toolbar}</div>}
      </header>
      <div className="px-2 pb-3 sm:px-3">{children}</div>
    </section>
  );
}
