"use client";

import Link from "next/link";
import { useTrip } from "../lib/trip-store";

export function TripLink() {
  const trip = useTrip();
  const count = trip.items.length;
  return (
    <Link href="/trip">
      Trip{count > 0 ? <span className="trip-count">{count}</span> : null}
    </Link>
  );
}
