import type { ItineraryBlock, ItineraryGrain } from "@serendipity/catalog";
import Link from "next/link";

const GRAIN_COPY: Record<ItineraryGrain, string> = {
  month: "A year reads month by month — one headline stop each month.",
  week: "A month reads week by week — one headline stop.",
  day: "A fortnight reads day by day. Half-days appear when two windows fit.",
  "half-day": "A short window is morning and afternoon. Half a day is the finest grain.",
};

export function Itinerary({
  grain,
  blocks,
  title,
  kicker,
}: {
  grain: ItineraryGrain;
  blocks: ItineraryBlock[];
  title: string;
  kicker: string;
}) {
  return (
    <section className="itinerary" id="itinerary">
      <p className="label">{kicker}</p>
      <h2>{title}</h2>
      <p className="explainer">{GRAIN_COPY[grain]}</p>
      {blocks.length ? (
        <ol className="itinerary-list">
          {blocks.map((block) => (
            <li key={block.id}>
              <time dateTime={block.id}>{block.label}</time>
              {block.stops.map((stop) => (
                <div key={stop.phenomenonSlug} className="itinerary-stop">
                  <Link href={stop.href}>{stop.name}</Link>
                  <p>
                    {stop.placeName}
                    {stop.travelPhrase ? ` · ${stop.travelPhrase}` : ""}
                  </p>
                  {stop.fromPrev ? <p className="from-prev">{stop.fromPrev}</p> : null}
                  <p className="explainer">{stop.peakLabel}</p>
                </div>
              ))}
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty">Nothing in this window for the current filters.</p>
      )}
    </section>
  );
}
