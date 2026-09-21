import type { OfferSeed } from "@serendipity/catalog";
import Link from "next/link";

const names = { viator: "Viator", gyg: "GetYourGuide", booking: "Booking.com" };

export function OfferList({ offers }: { offers: OfferSeed[] }) {
  if (offers.length === 0) return null;
  return (
    <section>
      <div className="disclosure">
        Serendipity earns a commission on tours booked through these links. Guides are sorted by
        relevance to your dates and reviewer rating — not commission. Ranking is never monetized.
        Sample offers — prototype.
      </div>
      <h2 style={{ margin: "1.4rem 0 0.9rem" }}>Book a guided experience</h2>
      <div className="cards">
        {offers.map((offer) => (
          <article key={offer.id} className="offer">
            <p className="label">
              {names[offer.providerId]} · ★ {offer.rating.toFixed(1)} ({offer.reviewCount})
            </p>
            <h3>{offer.title}</h3>
            <p className="explainer">{offer.supplierName}</p>
            <p>
              From {(offer.priceFromMinor / 100).toLocaleString("en", { style: "currency", currency: offer.currency })}
              <span className="explainer"> / person · as of {offer.priceAsOf.slice(0, 7)}</span>
            </p>
            <Link className="button" href={`/go/demo/${offer.id}`} rel="sponsored nofollow">
              Book on {names[offer.providerId]} ↗
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
