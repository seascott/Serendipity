"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TripLink } from "./TripLink";

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="nav-links">
      <Link href="/plan?collection=great-migrations" data-active={path.startsWith("/plan") || path.startsWith("/year")}>
        Plan
      </Link>
      <Link href="/explore?origin=florence" data-active={path.startsWith("/explore")}>
        Explore
      </Link>
      <span data-active={path.startsWith("/trip") ? "true" : undefined}>
        <TripLink />
      </span>
      <span className="demo-now" title="Pinned demo clock">
        20 Sep 2026
      </span>
      <Link href="/login" data-active={path.startsWith("/login")}>
        Sign in
      </Link>
    </nav>
  );
}
