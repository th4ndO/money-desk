import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getHistorySources, getLoanEntries } from "./data";
import { formatZAR } from "./money";
import { type HistoryEntry, buildHistory } from "./history";
import { openLoans } from "./loans";

/** Per-envelope history for one cycle, plus open loans for the forms. */
export async function getCycleExtras(supabase: SupabaseClient, cycleId: string) {
  const [sources, loanEntries] = await Promise.all([getHistorySources(supabase, cycleId), getLoanEntries(supabase)]);
  const histories = new Map<string, HistoryEntry[]>();
  for (const e of buildHistory(sources)) {
    if (!e.itemId || e.type === "bill") continue;
    histories.set(e.itemId, [...(histories.get(e.itemId) ?? []), e]);
  }
  const loans = openLoans(loanEntries);
  const loanOptions = loans.map((l) => ({ id: l.id, label: `${l.counterparty} · ${formatZAR(l.outstanding)} owed` }));
  return { histories, loans, loanOptions };
}
