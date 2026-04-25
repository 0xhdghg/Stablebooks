"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/invoices", label: "Invoices" },
  { href: "/webhooks", label: "Webhooks" }
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation">
      <ul className="nav-list">
        {links.map((link) => {
          const active =
            pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));

          return (
            <li key={link.href}>
              <Link className="nav-link" data-active={active} href={link.href}>
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
