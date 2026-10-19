export type Tone = "good" | "warn" | "bad" | "neutral" | "accent";

export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}
