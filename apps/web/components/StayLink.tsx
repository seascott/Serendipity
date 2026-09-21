import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";

export function StayLink({
  href,
  children,
  ...rest
}: LinkProps & { children: ReactNode; className?: string; "data-active"?: boolean }) {
  return (
    <Link href={href} scroll={false} {...rest}>
      {children}
    </Link>
  );
}
