import { buildItinerary, ITALY_WINDOW, places, tierExplore, travelLine } from "@serendipity/catalog";
import type { Family } from "@serendipity/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { Itinerary } from "../../components/Itinerary";
import { PhenomenonCard } from "../../components/PhenomenonCard";
import { Scene } from "../../components/Scene";
import { JourneyMap } from "../../components/JourneyMap";
import { JourneyChat } from "../../components/JourneyChat";
import { StayLink } from "../../components/StayLink";
import { TransitPanel } from "../../components/TransitPanel";
import { loadOccurrences, occurrenceSource } from "../../lib/data/occurrences";
import { EXPLORE_PROMPTS } from "../../lib/intent";
import { pinsFromCards } from "../../lib/pins";
import { ORIGINS, demoNow, type OriginKey } from "../../lib/now";

export const metadata: Metadata = {
  title: "Explore Italy · Serendipity",
  robots: { index: false, follow: false },
};

const FAMILIES: readonly Family[] = ["wildlife", "astronomy", "cultural", "seasonal_nature", "activity"];

function familyParam(value: string | undefined): Family[] | null {
  const match = FAMILIES.find((family) => family === value);
  return match ? [match] : null;
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ origin?: string; from?: string; to?: string; family?: string }>;
}) {
  const params = await searchParams;
  const originKey = (params.origin && params.origin in ORIGINS ? params.origin : "florence") as OriginKey;
  const origin = ORIGINS[originKey];
  const family = familyParam(params.family);
  const now = demoNow();
  const source = occurrenceSource();
  const rows = await loadOccurrences(
    { origin, from: ITALY_WINDOW.from, to: ITALY_WINDOW.to, families: family },
    source,
  );
  const { nearby, detour, coming, sky } = tierExplore({
    rows,
    now,
    from: ITALY_WINDOW.from,
    to: ITALY_WINDOW.to,
    origin,
    families: family,
  });
  const pins = pinsFromCards([...nearby, ...detour, ...coming]);
  const itinerary = buildItinerary({
    cards: [...nearby, ...detour, ...sky],
    from: ITALY_WINDOW.from,
    to: ITALY_WINDOW.to,
    zone: "Europe/Rome",
    showOriginTravel: true,
  });
  const transitHops = [...nearby, ...detour]
    .filter((card) => card.place)
    .sort((a, b) => a.distM - b.distM)
    .map((card) => ({
      id: card.id,
      name: card.phenomenon.name,
      place: card.place!.name,
      line: travelLine(card.distM, card.travel),
    }));

  const href = (next: Record<string, string>) => {
    const query = new URLSearchParams({
      origin: originKey,
      from: "2026-09-20",
      to: "2026-10-04",
      ...next,
    });
    if (!next.family && family?.[0]) query.set("family", family[0]);
    if (next.family === "") query.delete("family");
    return `/explore?${query.toString()}`;
  };

  return (
    <>
      <header className="page-hero">
        <Scene slug="vendemmia-chianti" family="activity" texture="vine" label="Chianti in harvest" />
        <div className="veil" />
        <div className="page-hero-copy">
          <p className="label">Explore · 20 Sep – 4 Oct 2026 · 14 days</p>
          <h1>What’s going on in Italy</h1>
          <p className="lede">
            From {origin.name} — nearby now, worth a detour, and what’s coming before you leave.
            Ask the guide or use the filters; the map follows.
          </p>
        </div>
      </header>
      <div className="context-bar">
        <div>
          <strong>{origin.name}, Italy</strong>
          <span className="explainer"> · ranked for this fortnight</span>
        </div>
        <div className="filters" style={{ margin: 0 }}>
          {Object.values(ORIGINS).map((item) => (
            <StayLink key={item.slug} href={href({ origin: item.slug })} data-active={item.slug === originKey}>
              {item.name}
            </StayLink>
          ))}
        </div>
      </div>
      <main className="shell">
        <div className="workspace" id="journey-workspace">
          <div className="workspace-tools">
            <JourneyChat
              prompts={EXPLORE_PROMPTS}
              intro={`You’re in ${origin.name} for a fortnight. Ask to change city, keep only harvests, or switch into planning a year.`}
              current={{ mode: "explore", origin: originKey }}
            />
            <div className="filters" style={{ marginTop: "1rem" }}>
              <StayLink href={href({ family: "" })} data-active={!family}>
                All
              </StayLink>
              {FAMILIES.map((item) => (
                <StayLink key={item} href={href({ family: item })} data-active={family?.[0] === item}>
                  {item.replace("_", " ")}
                </StayLink>
              ))}
            </div>
            <TransitPanel originName={origin.name} hops={transitHops} />
          </div>
          <JourneyMap
            pins={pins}
            center={[origin.lat, origin.lng]}
            zoom={6}
            origin={{ lat: origin.lat, lng: origin.lng, name: origin.name }}
          />
        </div>

        <Itinerary
          grain={itinerary.grain}
          blocks={itinerary.blocks}
          kicker="Itinerary · 14 days"
          title={`From ${origin.name}, day by day`}
        />

        <section className="tier now">
          <h2>Happening now</h2>
          <p className="explainer">Within about 150 km of {origin.name}</p>
          {nearby.length ? (
            <div className="cards" style={{ marginTop: "1rem" }}>
              {nearby.map((card) => (
                <PhenomenonCard key={card.id} card={card} />
              ))}
            </div>
          ) : (
            <p className="empty">Nothing this close is in window. Try another origin city or open Worth a detour.</p>
          )}
        </section>

        <section className="tier detour">
          <h2>Worth a detour</h2>
          <p className="explainer">Further out, still in your fortnight — rail range, with distance on each card</p>
          <div className="cards" style={{ marginTop: "1rem" }}>
            {detour.map((card) => (
              <PhenomenonCard key={card.id} card={card} />
            ))}
          </div>
        </section>

        <section className="tier">
          <h2>Coming up before you leave</h2>
          <p className="explainer">Starts after 4 Oct, still in this region</p>
          {coming.length ? (
            <div className="cards" style={{ marginTop: "1rem" }}>
              {coming.map((card) => (
                <PhenomenonCard key={card.id} card={card} />
              ))}
            </div>
          ) : (
            <p className="empty">Nothing queued in the next 90 days for this filter.</p>
          )}
        </section>

        <section className="sky">
          <Scene slug="harvest-full-moon" family="astronomy" texture="sky" label="Night sky" />
          <div className="veil" />
          <div className="sky-copy">
            <p className="label">The sky over Italy · 20 Sep 2026</p>
            <div className="sky-list">
              {sky.map((card) => (
                <div key={card.id}>
                  <h2>{card.phenomenon.name}</h2>
                  <p>
                    {card.windowLabel} · {card.peakLabel}. {card.phenomenon.summary}
                  </p>
                  <Link href={`/p/${card.phenomenon.slug}`}>Plan a dark night →</Link>
                </div>
              ))}
            </div>
          </div>
        </section>
        <p className="explainer" style={{ marginTop: "1.5rem" }}>
          {places.find((place) => place.slug === "italy")?.blurb} Catalog cited, not scraped.
          {source === "supabase" ? " Occurrences served by the explore() RPC." : " Occurrences from the in-memory demo catalog."}
        </p>
      </main>
    </>
  );
}
