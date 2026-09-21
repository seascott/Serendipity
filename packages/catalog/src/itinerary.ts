import { DateTime } from "luxon";
import { estimateTravel, haversineM, travelLine } from "./travel";
import type { RankedCard } from "./types";

export type ItineraryGrain = "month" | "week" | "day" | "half-day";

export type ItineraryStop = {
  phenomenonSlug: string;
  name: string;
  placeName: string;
  family: string;
  href: string;
  km: number | null;
  travelPhrase: string;
  fromPrev: string | null;
  peakLabel: string;
};

export type ItineraryBlock = {
  id: string;
  label: string;
  grain: ItineraryGrain;
  stops: ItineraryStop[];
};

export function itineraryGrain(from: Date, to: Date): ItineraryGrain {
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (days >= 120) return "month";
  if (days >= 28) return "week";
  if (days >= 4) return "day";
  return "half-day";
}

function overlaps(card: RankedCard, start: Date, end: Date): boolean {
  return new Date(card.during.start) < end && new Date(card.during.end) > start;
}

function toStop(
  card: RankedCard,
  previous: { lat: number; lng: number } | null,
  showOriginTravel: boolean,
): ItineraryStop {
  const place = card.place ? { lat: card.place.lat, lng: card.place.lng } : null;
  const hopM = previous && place ? haversineM(previous, place) : null;
  const hopTravel = hopM != null ? estimateTravel(hopM) : null;
  const fromPrev = hopM != null && hopTravel ? travelLine(hopM, hopTravel) : null;
  return {
    phenomenonSlug: card.phenomenon.slug,
    name: card.phenomenon.name,
    placeName: card.place?.name ?? "Worldwide",
    family: card.family,
    href: `/p/${card.phenomenon.slug}`,
    km: showOriginTravel && card.place ? Math.round(card.distM / 1000) : null,
    travelPhrase: showOriginTravel && card.place ? travelLine(card.distM, card.travel) : "",
    fromPrev: fromPrev && fromPrev !== "In town" ? `Then ${fromPrev} from the last stop` : null,
    peakLabel: card.peakLabel,
  };
}

function pickBest(cards: RankedCard[], start: Date, end: Date, used: Set<string>): RankedCard[] {
  return cards
    .filter((card) => overlaps(card, start, end) && !used.has(card.phenomenon.slug))
    .sort((a, b) => b.score - a.score || a.distM - b.distM);
}

export function buildItinerary(input: {
  cards: RankedCard[];
  from: Date;
  to: Date;
  zone?: string;
  showOriginTravel?: boolean;
}): { grain: ItineraryGrain; blocks: ItineraryBlock[] } {
  const grain = itineraryGrain(input.from, input.to);
  const zone = input.zone ?? "UTC";
  const showOriginTravel = input.showOriginTravel ?? false;
  const cards = input.cards.filter((card) => card.scope !== "global" || card.family === "astronomy");

  if (grain === "month") return { grain, blocks: monthBlocks(cards, input.from, input.to, showOriginTravel) };
  if (grain === "week") return { grain, blocks: weekBlocks(cards, input.from, input.to, zone, showOriginTravel) };
  return { grain, blocks: dayBlocks(cards, input.from, input.to, zone, showOriginTravel, grain) };
}

function monthBlocks(
  cards: RankedCard[],
  from: Date,
  to: Date,
  showOriginTravel: boolean,
): ItineraryBlock[] {
  const blocks: ItineraryBlock[] = [];
  let previous: { lat: number; lng: number } | null = null;
  const used = new Set<string>();
  let cursor = DateTime.fromJSDate(from, { zone: "utc" }).startOf("month");
  const end = DateTime.fromJSDate(to, { zone: "utc" });
  while (cursor < end) {
    const start = cursor.toJSDate();
    const next = cursor.plus({ months: 1 });
    const pick =
      pickBest(cards, start, next.toJSDate(), used)[0] ??
      cards
        .filter((card) => overlaps(card, start, next.toJSDate()))
        .sort((a, b) => b.score - a.score)[0];
    if (pick) {
      used.add(pick.phenomenon.slug);
      blocks.push({
        id: cursor.toFormat("yyyy-LL"),
        label: cursor.toFormat("LLLL yyyy"),
        grain: "month",
        stops: [toStop(pick, previous, showOriginTravel)],
      });
      previous = pick.place ? { lat: pick.place.lat, lng: pick.place.lng } : previous;
    }
    cursor = next;
  }
  return blocks;
}

function weekBlocks(
  cards: RankedCard[],
  from: Date,
  to: Date,
  zone: string,
  showOriginTravel: boolean,
): ItineraryBlock[] {
  const blocks: ItineraryBlock[] = [];
  let previous: { lat: number; lng: number } | null = null;
  const used = new Set<string>();
  let cursor = DateTime.fromJSDate(from, { zone });
  const end = DateTime.fromJSDate(to, { zone });
  while (cursor < end) {
    const start = cursor.toJSDate();
    const next = DateTime.min(cursor.plus({ weeks: 1 }), end);
    const pick = pickBest(cards, start, next.toJSDate(), used)[0];
    if (pick) {
      used.add(pick.phenomenon.slug);
      blocks.push({
        id: cursor.toISODate() ?? cursor.toFormat("yyyy-LL-dd"),
        label: `Week of ${cursor.toFormat("d LLL")}`,
        grain: "week",
        stops: [toStop(pick, previous, showOriginTravel)],
      });
      previous = pick.place ? { lat: pick.place.lat, lng: pick.place.lng } : previous;
    }
    cursor = next;
  }
  return blocks;
}

function dayBlocks(
  cards: RankedCard[],
  from: Date,
  to: Date,
  zone: string,
  showOriginTravel: boolean,
  grain: ItineraryGrain,
): ItineraryBlock[] {
  const blocks: ItineraryBlock[] = [];
  let previous: { lat: number; lng: number } | null = null;
  const cooldown = new Map<string, number>();
  let cursor = DateTime.fromJSDate(from, { zone }).startOf("day");
  const end = DateTime.fromJSDate(to, { zone });
  let dayIndex = 0;

  while (cursor < end) {
    const start = cursor.toJSDate();
    const next = cursor.plus({ days: 1 });
    const available = cards.filter((card) => {
      if (!overlaps(card, start, next.toJSDate())) return false;
      const last = cooldown.get(card.phenomenon.slug);
      if (last == null) return true;
      return grain === "half-day" && dayIndex - last >= 1;
    });
    const ranked = [...available].sort((a, b) => b.score - a.score || a.distM - b.distM);
    const morning = ranked[0];
    const eveningSky = ranked.find((card) => card.family === "astronomy" && card !== morning);
    const afternoon =
      eveningSky ??
      ranked.find(
        (card) =>
          card !== morning &&
          card.family !== morning?.family &&
          card.travel.minutes < 150 &&
          (morning?.travel.minutes ?? 0) < 120,
      );

    const useHalf = grain === "half-day" || Boolean(morning && afternoon);
    if (morning && afternoon && useHalf) {
      blocks.push({
        id: `${cursor.toISODate()}-am`,
        label: `${cursor.toFormat("ccc d LLL")} · morning`,
        grain: "half-day",
        stops: [toStop(morning, previous, showOriginTravel)],
      });
      previous = morning.place ? { lat: morning.place.lat, lng: morning.place.lng } : previous;
      cooldown.set(morning.phenomenon.slug, dayIndex);
      blocks.push({
        id: `${cursor.toISODate()}-pm`,
        label: `${cursor.toFormat("ccc d LLL")} · ${afternoon.family === "astronomy" ? "evening" : "afternoon"}`,
        grain: "half-day",
        stops: [toStop(afternoon, previous, showOriginTravel)],
      });
      previous = afternoon.place ? { lat: afternoon.place.lat, lng: afternoon.place.lng } : previous;
      cooldown.set(afternoon.phenomenon.slug, dayIndex);
    } else if (morning) {
      blocks.push({
        id: cursor.toISODate() ?? cursor.toFormat("yyyy-LL-dd"),
        label: grain === "half-day" ? `${cursor.toFormat("ccc d LLL")} · morning` : cursor.toFormat("ccc d LLL"),
        grain: grain === "half-day" ? "half-day" : "day",
        stops: [toStop(morning, previous, showOriginTravel)],
      });
      previous = morning.place ? { lat: morning.place.lat, lng: morning.place.lng } : previous;
      cooldown.set(morning.phenomenon.slug, dayIndex);
    }
    cursor = next;
    dayIndex += 1;
  }
  return blocks;
}
