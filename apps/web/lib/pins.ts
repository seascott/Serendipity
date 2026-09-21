import type { RankedCard } from "@serendipity/catalog";

export type JourneyPin = {
  id: string;
  href: string;
  name: string;
  place: string;
  lat: number;
  lng: number;
  family: string;
  slug: string;
  note?: string;
  tier?: 0 | 1 | 2 | 3;
};

export function pinsFromCards(cards: RankedCard[]): JourneyPin[] {
  const seen = new Set<string>();
  return cards.flatMap((card) => {
    if (!card.place) return [];
    const key = `${card.phenomenon.slug}:${card.place.slug}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [
      {
        id: card.id,
        href: `/p/${card.phenomenon.slug}`,
        name: card.phenomenon.name,
        place: card.place.name,
        lat: card.place.lat,
        lng: card.place.lng,
        family: card.family,
        slug: card.phenomenon.slug,
        note: card.peakLabel,
        tier: card.tier,
      },
    ];
  });
}
