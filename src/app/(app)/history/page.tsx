import Link from "next/link";
import { HistoryList } from "@/components/HistoryList";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { getHistorySources } from "@/lib/data";
import { HISTORY_FILTERS, type HistoryFilter, buildHistory } from "@/lib/history";

export const metadata = { title: "History" };

const TABS: { key: HistoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "income", label: "Income" },
  { key: "allocations", label: "Allocations" },
  { key: "spending", label: "Spending" },
  { key: "loans", label: "Loans" },
];

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const { supabase } = await requireUser();
  const { show } = await searchParams;
  const filter: HistoryFilter = typeof show === "string" && show in HISTORY_FILTERS ? (show as HistoryFilter) : "all";
  const entries = buildHistory(await getHistorySources(supabase)).filter(HISTORY_FILTERS[filter]);

  return (
    <div className="space-y-4">
      <PageHeader title="History" subtitle="Every rand in and out. Undo or delete anything entered by mistake." />
      <nav aria-label="Filter" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/history" : `/history?show=${t.key}`}
            aria-current={t.key === filter ? "page" : undefined}
            className={`btn btn-sm ${t.key === filter ? "btn-primary" : "btn-secondary"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <HistoryList entries={entries} empty="Nothing here yet." />
      <p className="text-xs text-muted">
        Bills show when they were ticked as paid; untick them on the cycle page. Undoing an allocation takes the money
        back out of where it went.
      </p>
    </div>
  );
}
