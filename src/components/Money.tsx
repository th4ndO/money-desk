import { formatZAR } from "@/lib/money";

/**
 * A rand amount in tabular monospace figures; red when negative if `signed`.
 * The thousands space is narrowed so "R1 585" doesn't read as two numbers
 * (a monospace space is as wide as a digit).
 */
export function Money({ cents, className = "", signed = false }: { cents: number; className?: string; signed?: boolean }) {
  const tone = signed && cents < 0 ? "text-bad" : "";
  const parts = formatZAR(cents).split(" ");
  return (
    <span className={`money whitespace-nowrap ${tone} ${className}`}>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="money-sep">{" "}</span>}
          {part}
        </span>
      ))}
    </span>
  );
}
