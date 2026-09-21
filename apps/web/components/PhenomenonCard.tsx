import { confidenceLabel, travelLine, type RankedCard } from "@serendipity/catalog";
import Link from "next/link";
import { AddToTripButton } from "./AddToTripButton";
import { Scene } from "./Scene";

function bandPercents(card: RankedCard) {
  const now = new Date("2026-09-20T09:00:00+02:00").getTime();
  const span = 28 * 86_400_000;
  const start = now - 10 * 86_400_000;
  const left = (iso: string) => Math.max(0, Math.min(100, ((new Date(iso).getTime() - start) / span) * 100));
  const today = ((now - start) / span) * 100;
  return {
    winL: left(card.during.start),
    winW: Math.max(3, left(card.during.end) - left(card.during.start)),
    pkL: card.peak ? left(card.peak.start) : null,
    pkW: card.peak ? Math.max(2, left(card.peak.end) - left(card.peak.start)) : null,
    today,
  };
}

export function PhenomenonCard({ card, showTravel = true }: { card: RankedCard; showTravel?: boolean }) {
  const level = confidenceLabel(card.confidence);
  const band = bandPercents(card);
  return (
    <article className={`card ${level}`}>
      <Scene
        className="card-scene"
        slug={card.phenomenon.slug}
        family={card.family}
        texture={card.phenomenon.scene.texture}
        label={card.phenomenon.name}
      />
      <div className="card-body">
        <div className="card-top">
          <span className="chip">{card.family.replace("_", " ")}</span>
          <span className={`pill ${level}`}>
            {level === "high" ? "High confidence" : level === "moderate" ? "Moderate" : "Approximate dates"}
          </span>
        </div>
        <h3>
          <Link href={`/p/${card.phenomenon.slug}`}>{card.phenomenon.name}</Link>
        </h3>
        <p className="explainer">
          {card.place?.name ?? "Worldwide"}
          {showTravel && card.place ? ` · ${travelLine(card.distM, card.travel)}` : ""}
        </p>
        <div className="mini-band" aria-hidden>
          <span className="win" style={{ left: `${band.winL}%`, width: `${band.winW}%` }} />
          {band.pkL != null && band.pkW != null ? (
            <span className="pk" style={{ left: `${band.pkL}%`, width: `${band.pkW}%` }} />
          ) : null}
          <span className="today" style={{ left: `${band.today}%` }} />
        </div>
        <p className="explainer">
          <strong className="peak">{card.peakLabel}</strong>
          {" · "}
          {card.windowLabel}
        </p>
        <div className="card-actions">
          <AddToTripButton
            id={card.id}
            phenomenonSlug={card.phenomenon.slug}
            phenomenonName={card.phenomenon.name}
            placeName={card.place?.name ?? null}
            windowLabel={card.windowLabel}
          />
          <Link href={`/p/${card.phenomenon.slug}`}>See how →</Link>
        </div>
      </div>
    </article>
  );
}
