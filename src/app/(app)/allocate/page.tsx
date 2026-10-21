import Link from "next/link";
import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { getCycleBundle, getCycles, getReadyToAllocate } from "@/lib/data";
import { formatShortDate, todayJHB } from "@/lib/dates";
import { formatZAR } from "@/lib/money";
import { cycleStatus, summariseCycle } from "@/lib/summary";
import type { ReserveRow } from "@/lib/types";
import { AllocateForm, type TargetGroup } from "./AllocateForm";

export const metadata = { title: "Allocate" };

export default async function AllocatePage({ searchParams }: PageProps<"/allocate">) {
  const { supabase } = await requireUser();
  const today = todayJHB();
  const { cycle: wanted } = await searchParams;

  const [ready, cycles, reservesRes] = await Promise.all([
    getReadyToAllocate(supabase),
    getCycles(supabase),
    supabase.from("reserves").select("id, name, balance_cents, spendable, notes, sort_order").order("sort_order"),
  ]);
  const reserves = (reservesRes.data ?? []) as ReserveRow[];

  // Open cycles that can still take money: current, upcoming, or ended but not closed.
  const open = cycles
    .filter((c) => cycleStatus(c, today) !== "closed")
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const current = open.find((c) => cycleStatus(c, today) === "active");
  const selected = open.find((c) => c.id === wanted) ?? current ?? open.find((c) => c.start_date > today) ?? open.at(-1);
  const bundle = selected ? await getCycleBundle(supabase, selected.id) : null;

  const groups: TargetGroup[] = [];
  if (!bundle) {
    groups.push({
      title: "Reserves",
      targets: reserves.map((r) => ({ key: `pot:${r.id}`, name: r.name, detail: `${formatZAR(r.balance_cents)} in the pot` })),
    });
  } else {
    const s = summariseCycle(bundle.cycle, bundle.items, bundle.transactions, today);
    const left = new Map(s.envelopes.map((e) => [e.id, e.remaining]));
    const gap = s.planned - s.pocket;
    if (gap > 0) {
      groups.push({
        title: "Fund what's already planned",
        targets: [
          {
            key: `fund:${bundle.cycle.id}`,
            name: `${bundle.cycle.name} plan`,
            detail: `${formatZAR(gap)} planned but not funded yet. Raises the pocket only.`,
          },
        ],
      });
    }
    groups.push({
      title: `Envelopes · ${bundle.cycle.name}`,
      targets: bundle.items
        .filter((i) => i.kind === "envelope")
        .map((i) => ({
          key: `item:${i.id}`,
          name: i.name,
          detail: `${formatZAR(i.planned_cents)} allocated · ${formatZAR(left.get(i.id) ?? i.planned_cents)} left`,
        })),
    });
    groups.push({
      title: "Reserves",
      targets: reserves.map((r) => ({ key: `pot:${r.id}`, name: r.name, detail: `${formatZAR(r.balance_cents)} in the pot` })),
    });
    groups.push({
      folded: true,
      title: `Bills and savings · ${bundle.cycle.name}`,
      targets: bundle.items
        .filter((i) => i.kind !== "envelope")
        .map((i) => ({
          key: `item:${i.id}`,
          name: i.name,
          detail: `${formatZAR(i.planned_cents)} allocated${i.paid ? " · paid" : i.due_date ? ` · due ${formatShortDate(i.due_date)}` : ""}`,
        })),
    });
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Allocate" subtitle="Give money that came in a job." />

      <section className="card">
        <p className="text-sm text-muted">Ready to allocate</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight"><Money cents={ready} signed /></p>
        <p className="mt-1 text-sm text-muted">
          All income you&apos;ve recorded, minus what you&apos;ve already allocated.{" "}
          <Link href="/income" className="link">Record income</Link>
        </p>
      </section>

      {open.length > 1 && (
        <nav aria-label="Choose a cycle" className="flex flex-wrap gap-2">
          {open.map((c) => (
            <Link
              key={c.id}
              href={`/allocate?cycle=${c.id}`}
              aria-current={c.id === selected?.id ? "page" : undefined}
              className={`btn btn-sm ${c.id === selected?.id ? "btn-primary" : "btn-secondary"}`}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      )}

      {ready <= 0 ? (
        <p className="notice">
          {ready < 0
            ? "You've allocated more than the income you've recorded. Record the missing income, or undo an allocation on the Income page."
            : "Nothing to allocate yet. Record income first, then come back here to share it out."}
        </p>
      ) : (
        <AllocateForm ready={ready} groups={groups} today={today} />
      )}

      <p className="text-sm text-muted">
        Funding the plan raises the cycle&apos;s pocket only, so items stay as planned. Adding to an item raises that item
        and the pocket together (a top-up). Adding to a reserve raises its balance. You can undo any allocation on the
        Income page.
      </p>
    </div>
  );
}
