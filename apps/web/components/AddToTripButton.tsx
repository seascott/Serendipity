"use client";

import { useTrip } from "../lib/trip-store";

export function AddToTripButton(props: {
  id: string;
  phenomenonSlug: string;
  phenomenonName: string;
  placeName: string | null;
  windowLabel: string;
}) {
  const trip = useTrip();
  const saved = trip.items.some((item) => item.id === props.id);
  return (
    <button
      type="button"
      className={saved ? "button on-trip" : "ghost-link"}
      onClick={() => (saved ? trip.remove(props.id) : trip.add(props))}
    >
      {saved ? "On your trip" : "+ Add to trip"}
    </button>
  );
}
