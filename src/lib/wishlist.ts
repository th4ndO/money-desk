import type { Cents } from "./money";

export interface WishItem {
  id: string;
  name: string;
  price_cents: Cents;
  link: string | null;
  priority: 1 | 2 | 3;
  notes: string | null;
  bought_on: string | null;
  sort_order: number;
}

export const PRIORITY_LABEL = { 1: "Need soon", 2: "Want", 3: "Someday" } as const;

/** Open (not yet bought) items, most important first, then cheapest. */
export function openWishes<T extends Pick<WishItem, "bought_on" | "priority" | "price_cents" | "sort_order">>(items: readonly T[]): T[] {
  return items
    .filter((i) => !i.bought_on)
    .sort((a, b) => a.priority - b.priority || a.price_cents - b.price_cents || a.sort_order - b.sort_order);
}

/**
 * Which open items a budget would cover, taking them in order of priority
 * (cheapest first within a priority) and skipping any that don't fit.
 */
export function affordable<T extends Pick<WishItem, "id" | "bought_on" | "priority" | "price_cents" | "sort_order">>(
  items: readonly T[],
  budget: Cents,
): { covered: T[]; left: Cents } {
  let left = Math.max(0, budget);
  const covered: T[] = [];
  for (const item of openWishes(items)) {
    if (item.price_cents <= left) {
      covered.push(item);
      left -= item.price_cents;
    }
  }
  return { covered, left };
}
