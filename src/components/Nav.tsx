"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/cycles", label: "Cycles" },
  { href: "/recurring", label: "Recurring" },
  { href: "/income", label: "Income" },
  { href: "/more", label: "More" },
];

const MORE = ["/more", "/reserves", "/todos", "/settings"];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/more") return MORE.some((p) => pathname.startsWith(p));
  return pathname.startsWith(href);
}

export function Nav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="nav">
      <ul className="mx-auto flex max-w-3xl">
        {LINKS.map((l) => (
          <li key={l.href} className="flex-1">
            <Link
              href={l.href}
              aria-current={isActive(pathname, l.href) ? "page" : undefined}
              className="nav-link"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
