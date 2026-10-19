import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";
import { requireUser } from "@/lib/auth";
import type { ReserveRow } from "@/lib/types";
import { DeleteReserve, ReserveForm } from "./forms";

export const metadata = { title: "Reserves" };

export default async function ReservesPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("reserves")
    .select("id, name, balance_cents, spendable, notes, sort_order")
    .order("sort_order")
    .order("created_at");
  const reserves = (data ?? []) as ReserveRow[];
  const total = reserves.reduce((s, r) => s + r.balance_cents, 0);
  const spendable = reserves.filter((r) => r.spendable).reduce((s, r) => s + r.balance_cents, 0);

  return (
    <div className="space-y-8">
      <PageHeader title="Reserves" subtitle="Named pots. Update the balances by hand." />
      <section className="grid grid-cols-2 gap-3">
        <div className="card"><p className="text-sm text-muted">Total</p><p className="mt-1 text-xl font-semibold"><Money cents={total} /></p></div>
        <div className="card"><p className="text-sm text-muted">Spendable</p><p className="mt-1 text-xl font-semibold"><Money cents={spendable} /></p></div>
      </section>
      <section>
        {reserves.length === 0 ? (
          <p className="text-muted">No pots yet.</p>
        ) : (
          <ul>
            {reserves.map((r) => (
              <li key={r.id} className="row block">
                <details>
                  <summary className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.name}</p>
                      {r.notes && <p className="truncate text-sm text-muted">{r.notes}</p>}
                    </div>
                    {r.spendable && <Pill tone="accent">Spendable</Pill>}
                    <Money cents={r.balance_cents} className="font-semibold" />
                  </summary>
                  <div className="mt-3 space-y-2">
                    <ReserveForm reserve={r} />
                    <DeleteReserve id={r.id} name={r.name} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card" aria-labelledby="add-reserve">
        <h2 id="add-reserve" className="mb-4 font-semibold">Add a pot</h2>
        <ReserveForm />
      </section>
    </div>
  );
}
