"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionResult, NETWORK_FAIL, fail, ok, parseForm, zId, zMoney, zOptionalText } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { todayJHB } from "@/lib/dates";
import { formatZAR } from "@/lib/money";

const wishSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "What is it?").max(100),
  price: zMoney,
  link: zOptionalText(500).refine((l) => l === null || /^https?:\/\//i.test(l), "Links start with https://"),
  priority: z.enum(["1", "2", "3"]).transform(Number),
  notes: zOptionalText(500),
});

export async function saveWish(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(wishSchema, fd);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const { supabase } = await requireUser();
  const row = { name: v.name, price_cents: v.price, link: v.link, priority: v.priority, notes: v.notes };

  if (v.id) {
    const id = zId.safeParse(v.id);
    if (!id.success) return fail("Something went wrong: refresh the page and try again.");
    const { error } = await supabase.from("wishlist").update(row).eq("id", id.data);
    if (error) return fail(NETWORK_FAIL);
    refresh();
    return ok(`Saved ${v.name}`);
  }
  const { data: last } = await supabase.from("wishlist").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("wishlist").insert({ ...row, sort_order: (last?.sort_order ?? -1) + 1 });
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok(`Added ${v.name} (${formatZAR(v.price)})`);
}

export async function setWishBought(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ id: zId, paid: z.enum(["true", "false"]) }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const bought = parsed.data.paid === "true";
  const { data, error } = await supabase
    .from("wishlist")
    .update({ bought_on: bought ? todayJHB() : null })
    .eq("id", parsed.data.id)
    .select("name")
    .single();
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok(bought ? `Got it: ${data.name}. Log what it cost on Today.` : `${data.name} is back on the list`);
}

export async function deleteWish(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ id: zId }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("wishlist").delete().eq("id", parsed.data.id);
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok("Removed from the wish list");
}
