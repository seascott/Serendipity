import { buildItinerary, collections, DEMO_NOW, rankOccurrence, yearBands } from "@serendipity/catalog";
import { getCatalog } from "@serendipity/catalog/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { YearChart } from "../../components/YearChart";
import { Itinerary } from "../../components/Itinerary";
import { PhenomenonCard } from "../../components/PhenomenonCard";
import { Scene } from "../../components/Scene";
import { JourneyMap } from "../../components/JourneyMap";
import { JourneyChat } from "../../components/JourneyChat";
import { StayLink } from "../../components/StayLink";
import { TransitPanel } from "../../components/TransitPanel";
import { PLAN_PROMPTS } from "../../lib/intent";
import { pinsFromCards } from "../../lib/pins";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FAMILIES = ["wildlife", "astronomy", "cultural", "seasonal_nature", "activity"] as const;

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ collection?: string; family?: string; month?: string }>;
}) {
  const params = await searchParams;
  const collection = collections.find((item) => item.slug === (params.collection ?? "great-migrations"));
  if (!collection) notFound();
  const family = params.family && FAMILIES.includes(params.family as (typeof FAMILIES)[number]) ? params.family : null;
  const month = params.month ? Number(params.month) : null;
  const rows = getCatalog();
  const bands = yearBands(rows, collection, 2026).filter((row) => !family || row.phenomenon.family === family);
  const now = DEMO_NOW.getTime();
  const yearStart = new Date(Date.UTC(2026, 0, 1));
  const yearEnd = new Date(Date.UTC(2027, 0, 1));
  const windowFrom = month ? new Date(Date.UTC(2026, month - 1, 1)) : yearStart;
  const windowTo = month ? new Date(Date.UTC(2026, month, 1)) : yearEnd;
  const activeSlugs = [
    ...new Set(
      rows
        .filter((row) => {
          if (!collection.phenomenonSlugs.includes(row.phenomenon.slug)) return false;
          const start = new Date(row.during.start).getTime();
          const end = new Date(row.during.end).getTime();
          return start <= now && now < end;
        })
        .map((row) => row.phenomenon.slug),
    ),
  ];
  const featured = activeSlugs
    .map((phenomenonSlug) => rows.find((row) => row.phenomenon.slug === phenomenonSlug))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const inWindow = (row: (typeof rows)[number]) => {
    const start = new Date(row.during.start);
    const end = new Date(row.during.end);
    return start < windowTo && end > windowFrom;
  };

  const itineraryCards = rows
    .filter((row) => collection.phenomenonSlugs.includes(row.phenomenon.slug))
    .filter((row) => !family || row.family === family)
    .filter(inWindow)
    .map((row) => ({ ...rankOccurrence(row, DEMO_NOW, { lat: 0, lng: 0 }, 2_000_000, []), tier: 1 as const }));

  const cards = collection.phenomenonSlugs.flatMap((phenomenonSlug) => {
    const matches = itineraryCards.filter((row) => row.phenomenon.slug === phenomenonSlug);
    const match =
      matches.find((row) => new Date(row.during.start) <= DEMO_NOW && DEMO_NOW < new Date(row.during.end)) ??
      matches[0];
    return match ? [match] : [];
  });

  const itinerary = buildItinerary({
    cards: itineraryCards,
    from: windowFrom,
    to: windowTo,
    zone: "UTC",
    showOriginTravel: false,
  });
  const transitHops = itinerary.blocks.flatMap((block) =>
    block.stops.map((stop) => ({
      id: `${block.id}-${stop.phenomenonSlug}`,
      name: stop.name,
      place: stop.placeName,
      line: stop.fromPrev ? stop.fromPrev.replace(/^Then /, "") : "Opening stop",
    })),
  );

  const href = (next: Record<string, string>) => {
    const query = new URLSearchParams({ collection: collection.slug, ...next });
    if (!next.family && family) query.set("family", family);
    if (next.family === "") query.delete("family");
    if (!next.month && month) query.set("month", String(month));
    if (next.month === "") query.delete("month");
    return `/plan?${query.toString()}`;
  };

  return (
    <>
      <header className="page-hero">
        <Scene
          slug="wildebeest-great-migration"
          family="wildlife"
          texture="field"
          label="Great migration savanna"
        />
        <div className="veil" />
        <div className="page-hero-copy">
          <p className="label">Plan · {collection.kicker}</p>
          <h1>{collection.title}</h1>
          <p className="lede">{collection.intro}</p>
        </div>
      </header>
      <main className="shell">
        <div className="workspace" id="journey-workspace">
          <div className="workspace-tools">
            <JourneyChat
              prompts={PLAN_PROMPTS}
              intro="Configure this year. Ask for a species, a month, or switch into exploring a place you’re already going."
              current={{ mode: "plan" }}
            />
            <div className="filters" style={{ marginTop: "1rem" }}>
              <StayLink href={href({ family: "" })} data-active={!family}>
                All
              </StayLink>
              {FAMILIES.map((item) => (
                <StayLink key={item} href={href({ family: item })} data-active={family === item}>
                  {item.replace("_", " ")}
                </StayLink>
              ))}
            </div>
            <div className="filters">
              <StayLink href={href({ month: "" })} data-active={!month}>
                Whole year
              </StayLink>
              {MONTHS.map((label, index) => (
                <StayLink
                  key={label}
                  href={href({ month: String(index + 1) })}
                  data-active={month === index + 1}
                >
                  {label}
                </StayLink>
              ))}
            </div>
            <TransitPanel hops={transitHops} />
          </div>
          <JourneyMap pins={pinsFromCards(cards)} center={[12, 20]} zoom={2} />
        </div>

        <Itinerary
          grain={itinerary.grain}
          blocks={itinerary.blocks}
          kicker={month ? `Itinerary · ${MONTHS[month - 1]} 2026` : "Itinerary · 2026"}
          title={month ? `Week by week in ${MONTHS[month - 1]}` : "Twelve months, twelve headline stops"}
        />

        {featured[0] ? (
          <aside className="in-season">
            <Scene
              slug={featured[0].phenomenon.slug}
              family={featured[0].phenomenon.family}
              texture={featured[0].phenomenon.scene.texture}
              label={featured[0].phenomenon.name}
            />
            <div>
              <p className="label">In window this week</p>
              <h2 style={{ margin: "0.35rem 0 0.5rem" }}>{featured[0].phenomenon.name}</h2>
              <p className="explainer">{featured[0].phenomenon.summary}</p>
              <p style={{ marginTop: "0.8rem" }}>
                <Link href={`/p/${featured[0].phenomenon.slug}`}>See how to be there →</Link>
              </p>
            </div>
          </aside>
        ) : null}
        <YearChart rows={bands} year={2026} activeSlugs={activeSlugs} />
        <h2 style={{ margin: "3.5rem 0 0.6rem" }}>The year’s great events</h2>
        <p className="explainer">
          Click a pin, a chart row, or a card — same catalog. Hops between months are great-circle estimates.
        </p>
        <div className="cards" style={{ marginTop: "1.2rem" }}>
          {cards.map((card) => (
            <PhenomenonCard key={card.phenomenon.slug} card={card} showTravel={false} />
          ))}
        </div>
        <p style={{ marginTop: "2.5rem" }}>
          <Link href="/explore?origin=florence">Or explore Italy this fortnight →</Link>
        </p>
      </main>
    </>
  );
}
