import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "More" };

const LINKS = [
  { href: "/history", label: "History", hint: "Every income, allocation, spend and loan, with undo" },
  { href: "/reserves", label: "Reserves", hint: "Named pots and their balances" },
  { href: "/todos", label: "To do", hint: "Money admin checklist" },
  { href: "/settings", label: "Settings", hint: "Cycle start day, backups, sign out" },
];

export default function MorePage() {
  return (
    <div>
      <PageHeader title="More" />
      <ul className="space-y-3">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="card block hover:border-accent">
              <p className="font-semibold">{l.label}</p>
              <p className="text-sm text-muted">{l.hint}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
