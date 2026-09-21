import { happeningSoon } from "@serendipity/catalog";
import { getCatalog } from "@serendipity/catalog/server";
import Link from "next/link";
import { Scene } from "../components/Scene";
import { JourneyChat } from "../components/JourneyChat";
import { HOME_PROMPTS } from "../lib/intent";
import { demoNow } from "../lib/now";

export default function HomePage() {
  const soon = happeningSoon(getCatalog(), demoNow());

  return (
    <>
      <section className="split-hero" aria-label="Two ways in">
        <Link className="cover" href="/plan?collection=great-migrations">
          <Scene
            slug="wildebeest-great-migration"
            family="wildlife"
            texture="field"
            label="Savanna dusk"
          />
          <div className="veil" />
          <div className="copy">
            <p className="kicker">Plan · a year on the calendar</p>
            <h2>Follow a Planet Earth year</h2>
            <p>
              Ask for the great migrations — wildebeest, monarchs, gray whales, the sardine run —
              and we’ll lay the year on a map you can filter.
            </p>
            <span className="cta">Start planning →</span>
          </div>
        </Link>
        <Link className="cover cover-b" href="/explore?origin=florence&from=2026-09-20&to=2026-10-04">
          <Scene slug="vendemmia-chianti" family="activity" texture="vine" label="Chianti harvest" />
          <div className="veil" />
          <div className="copy">
            <p className="kicker">Explore · a place you’re already in</p>
            <h2>I’m in Italy the next two weeks</h2>
            <p>
              Tell us Florence, Rome or Venice. Harvest, truffles, larch, sagre, and the birds
              moving through the Po Delta — ranked on a map from where you stand.
            </p>
            <span className="cta">Start exploring →</span>
          </div>
        </Link>
      </section>

      <main className="shell home-rail">
        <JourneyChat
          prompts={HOME_PROMPTS}
          intro="Plan a year, or explore a window you’re already in. Type it the way you’d say it to a friend."
        />
        <div className="rail-head" style={{ marginTop: "2.5rem" }}>
          <h2>In season right now</h2>
          <p className="kicker">next 30 days · 20 Sep 2026</p>
        </div>
        <div className="rail">
          {soon.map((card) => (
            <Link key={card.id} className="teaser" href={`/p/${card.phenomenon.slug}`}>
              <Scene
                slug={card.phenomenon.slug}
                family={card.family}
                texture={card.phenomenon.scene.texture}
                label={card.phenomenon.name}
              />
              <div className="body">
                <strong>{card.phenomenon.name}</strong>
                <span className="explainer">
                  {card.place?.name ?? "Worldwide"} · {card.peakLabel}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
