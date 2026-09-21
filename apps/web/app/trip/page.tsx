"use client";

import Link from "next/link";
import { useTrip } from "../../lib/trip-store";
import { Scene } from "../../components/Scene";

export default function TripPage() {
  const trip = useTrip();
  return (
    <>
      <header className="page-hero compact">
        <Scene slug="dolomites-larch-turn" family="seasonal_nature" texture="ridge" label="Packed trip" />
        <div className="veil" />
        <div className="page-hero-copy">
          <p className="label">Your trip</p>
          <h1>Packed for later</h1>
          <p className="lede">Saved on this browser only. No account required for the prototype.</p>
        </div>
      </header>
      <main className="shell shell-narrow">
        {trip.items.length === 0 ? (
          <p className="empty">
            Nothing packed yet. Open the{" "}
            <Link href="/plan?collection=great-migrations">Planet Earth year</Link> or{" "}
            <Link href="/explore?origin=florence">Italy fortnight</Link> and add a window.
          </p>
        ) : (
          <div className="cards" style={{ marginTop: "0.5rem" }}>
            {trip.items.map((item) => (
              <article key={item.id} className="card">
                <div className="card-body">
                  <h3>
                    <Link href={`/p/${item.phenomenonSlug}`}>{item.phenomenonName}</Link>
                  </h3>
                  <p className="explainer">
                    {item.placeName ?? "Worldwide"} · {item.windowLabel}
                  </p>
                  <button type="button" className="ghost-link" onClick={() => trip.remove(item.id)}>
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
