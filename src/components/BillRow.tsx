import { setPaid } from "@/app/(app)/cycles/actions";
import { formatShortDate } from "@/lib/dates";
import type { CycleItemRow } from "@/lib/types";
import { Money } from "./Money";
import { TickButton } from "./TickButton";

export function BillRow({ item, readOnly, today }: { item: CycleItemRow; readOnly?: boolean; today: string }) {
  const late = !item.paid && item.due_date !== null && item.due_date < today;
  return (
    <li className="row">
      <TickButton itemId={item.id} paid={item.paid} label={item.name} action={setPaid} disabled={readOnly} />
      <div className="min-w-0 flex-1">
        <p className={`truncate font-medium ${item.paid ? "text-muted line-through decoration-1" : ""}`}>{item.name}</p>
        <p className={`text-sm ${late ? "text-warn" : "text-muted"}`}>
          {item.due_date ? `${late ? "Was due" : "Due"} ${formatShortDate(item.due_date)}` : "No date"}
          {item.kind === "saving" && " · saving"}
        </p>
      </div>
      <Money cents={item.paid ? (item.actual_cents ?? item.planned_cents) : item.planned_cents} />
    </li>
  );
}
