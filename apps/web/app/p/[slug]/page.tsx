import { DEMO_NOW, nextOccurrences, offers, phenomena, slugId, yearBands } from "@serendipity/catalog";
import { getCatalog } from "@serendipity/catalog/server";
import { formatWindow } from "@serendipity/domain";
import { notFound } from "next/navigation";
import Link from "next/link";
import { OfferList } from "../../../components/OfferList";
import { YearChart } from "../../../components/YearChart";
import { AddToTripButton } from "../../../components/AddToTripButton";
import { Scene } from "../../../components/Scene";

export function generateStaticParams() {
  return phenomena.map((phenomenon) => ({ slug: phenomenon.slug }));
}

export default async function PhenomenonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const phenomenon = phenomena.find((item) => item.slug === slug);
  if (!phenomenon) notFound();
  const rows = getCatalog().filter((row) => row.phenomenon.slug === slug);
  const next = nextOccurrences(rows, slug, DEMO_NOW, 3);
  const first =
    rows.find((row) => new Date(row.during.start) <= DEMO_NOW && DEMO_NOW < new Date(row.during.end)) ??
    rows.find((row) => new Date(row.during.start) >= DEMO_NOW) ??
    rows[0];
  const relatedOffers = offers.filter((offer) => offer.phenomenonSlugs.includes(slug));
  const bands = yearBands(
    rows,
    {
      slug,
      title: phenomenon.name,
      kicker: "",
      intro: "",
      phenomenonSlugs: [slug],
      defaultYear: 2026,
    },
    2026,
  );

  return (
    <>
      <header className="page-hero compact">
        <Scene
          slug={phenomenon.slug}
          family={phenomenon.family}
          texture={phenomenon.scene.texture}
          label={phenomenon.name}
        />
        <div className="veil" />
        <div className="page-hero-copy">
          <p className="label">
            {phenomenon.family.replace("_", " ")} / {phenomenon.tags[0]}
          </p>
          <h1>{phenomenon.name}</h1>
          <p className="lede">{phenomenon.summary}</p>
        </div>
      </header>
      <main className="shell shell-narrow">
        <div className="card-actions" style={{ border: 0, padding: "0 0 1.2rem" }}>
          <AddToTripButton
            id={first?.id ?? slugId(slug)}
            phenomenonSlug={slug}
            phenomenonName={phenomenon.name}
            placeName={first?.place?.name ?? null}
            windowLabel={
              first
                ? formatWindow(
                    { start: new Date(first.during.start), end: new Date(first.during.end) },
                    first.place?.timezone ?? "UTC",
                    first.granularity,
                  )
                : "See windows"
            }
          />
          <Link href="/trip">Open trip</Link>
        </div>

        {bands.length ? <YearChart rows={bands} year={2026} activeSlugs={[slug]} /> : null}

        <h2 style={{ margin: "2.5rem 0 1rem" }}>Next windows</h2>
        <div className="cards">
          {next.map((row) => (
            <article key={row.id} className="card">
              <div className="card-body">
                <h3>
                  {formatWindow(
                    { start: new Date(row.during.start), end: new Date(row.during.end) },
                    row.place?.timezone ?? "UTC",
                    row.granularity,
                  )}
                </h3>
                <p className="explainer">
                  {row.place?.name ?? "Global"} · confidence {(row.confidence * 100).toFixed(0)}%
                </p>
                {row.rule.note ? <p className="explainer">{row.rule.note}</p> : null}
              </div>
            </article>
          ))}
        </div>

        <div className="prose">
          <h2 style={{ margin: "2.75rem 0 0.8rem" }}>What to expect</h2>
          {phenomenon.description.split("\n\n").map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
          <h3 style={{ margin: "1.6rem 0 0.6rem" }}>How to be there</h3>
          <p>{phenomenon.howToSee}</p>
        </div>
        {phenomenon.ethics ? (
          <div className="ethics">
            <h3>How to be there without harm</h3>
            <p>{phenomenon.ethics}</p>
          </div>
        ) : null}

        <h2 style={{ margin: "2.5rem 0 0.8rem" }}>Where to go</h2>
        <div className="filters">
          {[
            ...new Map(rows.filter((row) => row.place).map((row) => [row.place!.slug, row.place!])).values(),
          ].map((place) => (
            <span key={place.slug} className="chip">
              {place.name}
            </span>
          ))}
        </div>

        <div style={{ marginTop: "2.5rem" }}>
          <OfferList offers={relatedOffers} />
        </div>

        <section style={{ marginTop: "2.5rem", borderTop: "1px solid var(--line)", paddingTop: "1.2rem" }}>
          <p className="label">Sources & editorial notes</p>
          <ul>
            {[...new Map(rows.map((row) => [row.source.slug, row.source])).values()].map((source) => (
              <li key={source.slug} className="explainer">
                <a href={source.url} rel="noreferrer">
                  {source.title}
                </a>{" "}
                — {source.publisher}, last verified {source.lastVerified}. Cited, not reproduced.
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
