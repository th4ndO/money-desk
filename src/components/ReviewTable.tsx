import type { CycleReview } from "@/lib/review";
import { Money } from "./Money";

/** Planned vs actual per item. Over is red, under is green. */
export function ReviewTable({ review }: { review: CycleReview }) {
  const diff = (d: number) =>
    d === 0 ? (
      <span className="text-muted">on plan</span>
    ) : (
      <span className={d > 0 ? "text-bad" : "text-good"}>
        <Money cents={Math.abs(d)} /> {d > 0 ? "over" : "under"}
      </span>
    );
  return (
    <div className="space-y-3">
      <ul>
        {review.lines.map((l) => (
          <li key={l.id ?? l.name} className="row items-start">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{l.name}</p>
              <p className="text-sm text-muted">
                <Money cents={l.planned} /> planned · <Money cents={l.actual} /> actual
                {l.note && <span className="text-warn"> · {l.note}</span>}
              </p>
            </div>
            <p className="text-right text-sm">{diff(l.difference)}</p>
          </li>
        ))}
      </ul>
      <div className="card grid grid-cols-2 gap-2 text-sm">
        <span className="text-muted">Planned</span>
        <Money cents={review.planned} className="text-right" />
        <span className="text-muted">Actual</span>
        <Money cents={review.actual} className="text-right" />
        <span className="font-semibold">Total</span>
        <span className="text-right font-semibold">{diff(review.difference)}</span>
        <span className="text-muted">Left of the pocket</span>
        <Money cents={review.leftOver} signed className="text-right" />
      </div>
    </div>
  );
}
