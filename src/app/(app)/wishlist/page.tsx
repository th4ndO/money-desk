import Link from "next/link";
import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";
import { TickButton } from "@/components/TickButton";
import { requireUser } from "@/lib/auth";
import { getReadyToAllocate } from "@/lib/data";
import { formatShortDate } from "@/lib/dates";
import { PRIORITY_LABEL, type WishItem, affordable, openWishes } from "@/lib/wishlist";
import { setWishBought } from "./actions";
import { DeleteWish, WishForm } from "./forms";

export const metadata = { title: "Wish list" };

function WishRow({ item, coverable }: { item: WishItem; coverable: boolean }) {
  return (
    <li className="row block">
      <div className="flex items-center gap-3">
        <TickButton itemId={item.id} paid={!!item.bought_on} label={item.name} action={setWishBought} states={["bought", "not bought yet"]} />
        <details className="min-w-0 flex-1">
          <summary className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className={`truncate font-medium ${item.bought_on ? "text-muted line-through decoration-1" : ""}`}>{item.name}</p>
              <p className="truncate text-sm text-muted">
                {item.bought_on ? `Bought ${formatShortDate(item.bought_on)}` : PRIORITY_LABEL[item.priority]}
                {item.notes ? ` · ${item.notes}` : ""}
              </p>
            </div>
            {coverable && !item.bought_on && <Pill tone="good">Affordable</Pill>}
            <Money cents={item.price_cents} className="font-semibold" />
          </summary>
          <div className="mt-3 space-y-3">
            {item.link && (
              <a href={item.link} target="_blank" rel="noopener noreferrer nofollow" className="link text-sm break-all">
                Open the link
              </a>
            )}
            <WishForm item={item} />
            <DeleteWish id={item.id} name={item.name} />
          </div>
        </details>
      </div>
    </li>
  );
}

export default async function WishlistPage() {
  const { supabase } = await requireUser();
  const [res, ready] = await Promise.all([
    supabase.from("wishlist").select("id, name, price_cents, link, priority, notes, bought_on, sort_order").order("sort_order"),
    getReadyToAllocate(supabase),
  ]);
  const items = (res.data ?? []) as WishItem[];
  const open = openWishes(items);
  const bought = items.filter((i) => i.bought_on).sort((a, b) => (b.bought_on ?? "").localeCompare(a.bought_on ?? ""));
  const total = open.reduce((t, i) => t + i.price_cents, 0);
  const { covered } = affordable(items, ready);
  const coveredIds = new Set(covered.map((i) => i.id));

  return (
    <div className="space-y-6">
      <PageHeader title="Wish list" subtitle="Things you'd like to buy, and what they cost." />

      <section className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-sm text-muted">Total wished for</p>
          <p className="mt-1 text-xl font-semibold"><Money cents={total} /></p>
          <p className="text-xs text-muted">{open.length} {open.length === 1 ? "item" : "items"}</p>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Ready to allocate</p>
          <p className="mt-1 text-xl font-semibold"><Money cents={ready} signed /></p>
          <p className="text-xs text-muted">
            {covered.length > 0 ? `Covers ${covered.length} of them` : "Covers none yet"}
          </p>
        </div>
      </section>
      {covered.length > 0 && (
        <p className="notice text-sm">
          Your unallocated money could cover {covered.map((i) => i.name).join(", ")} (taking the ones you need most
          first). To buy one, <Link href="/allocate" className="link">allocate</Link> the money to an envelope, then log
          the spend.
        </p>
      )}

      <section aria-labelledby="open-title">
        <h2 id="open-title" className="section-title mb-1">On the list</h2>
        {open.length === 0 ? <p className="py-2 text-muted">Nothing yet.</p> : (
          <ul>{open.map((i) => <WishRow key={i.id} item={i} coverable={coveredIds.has(i.id)} />)}</ul>
        )}
      </section>

      <section className="card" aria-labelledby="add-wish">
        <h2 id="add-wish" className="mb-4 font-semibold">Add something</h2>
        <WishForm />
      </section>

      {bought.length > 0 && (
        <details>
          <summary className="section-title">Bought ({bought.length})</summary>
          <ul className="mt-2">{bought.map((i) => <WishRow key={i.id} item={i} coverable={false} />)}</ul>
        </details>
      )}
    </div>
  );
}
