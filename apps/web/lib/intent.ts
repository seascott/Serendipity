import { ORIGINS, type OriginKey } from "./now";

const FAMILIES = ["wildlife", "astronomy", "cultural", "seasonal_nature", "activity"] as const;

export type JourneyIntent = {
  href: string | null;
  title: string;
  body: string;
  mode: "plan" | "explore" | "ask";
};

function originFrom(text: string): OriginKey {
  if (/\brome\b|roma\b/.test(text)) return "rome";
  if (/\bvenice\b|venezia\b/.test(text)) return "venice";
  return "florence";
}

function familyFrom(text: string): string | null {
  if (/wildlife|bird|whale|migration|crane|wildebeest|monarch/.test(text)) return "wildlife";
  if (/moon|equinox|sky|astronomy/.test(text)) return "astronomy";
  if (/festival|sagra|fair|cultural/.test(text)) return "cultural";
  if (/larch|foliage|porcini|seasonal/.test(text)) return "seasonal_nature";
  if (/harvest|wine|truffle|vendemmia|olive|etna|activity/.test(text)) return "activity";
  return null;
}

export function interpretJourney(
  input: string,
  current?: { mode: "plan" | "explore"; origin?: OriginKey },
): JourneyIntent {
  const text = input.trim().toLowerCase();
  if (!text) {
    return {
      href: null,
      mode: "ask",
      title: "Say what you’re after",
      body: "Plan a year of migrations, or explore a place you’re already going.",
    };
  }

  const wantsExplore =
    /\bitaly\b|italia|florence|firenze|rome|roma|venice|venezia|two weeks|fortnight|what.?s going on|nearby|detour/.test(
      text,
    );
  const wantsPlan =
    /planet earth|great migration|migrations|full (calendar )?year|around the world|plan a year|wildebeest|monarch/.test(
      text,
    );

  if (wantsExplore && !wantsPlan) {
    const origin = originFrom(text);
    const family = familyFrom(text);
    const query = new URLSearchParams({
      origin,
      from: "2026-09-20",
      to: "2026-10-04",
    });
    if (family && FAMILIES.includes(family as (typeof FAMILIES)[number])) query.set("family", family);
    const city = ORIGINS[origin].name;
    return {
      href: `/explore?${query.toString()}`,
      mode: "explore",
      title: `Explore from ${city}`,
      body: `Italy, 20 Sep–4 Oct 2026. I’ll rank what’s nearby, worth a detour, and coming before you leave${family ? ` — filtered to ${family.replace("_", " ")}` : ""}.`,
    };
  }

  if (wantsPlan || /calendar|year view|all twelve/.test(text)) {
    const query = new URLSearchParams({ collection: "great-migrations" });
    const family = familyFrom(text);
    if (family) query.set("family", family);
    return {
      href: `/plan?${query.toString()}`,
      mode: "plan",
      title: "Plan a Planet Earth year",
      body: "Twelve months of great migrations on one calendar, with a world map of where to stand.",
    };
  }

  if (current?.mode === "plan" && /this week|in window|right now/.test(text)) {
    return {
      href: "/plan?collection=great-migrations&month=9",
      mode: "plan",
      title: "September on the calendar",
      body: "Pinned to 20 Sep 2026 — the windows that are open this month.",
    };
  }

  const familyOnly = familyFrom(text);
  if (familyOnly && !wantsExplore && !wantsPlan && current) {
    if (current.mode === "explore") {
      const origin = current.origin ?? "florence";
      const query = new URLSearchParams({ origin, from: "2026-09-20", to: "2026-10-04", family: familyOnly });
      return {
        href: `/explore?${query.toString()}`,
        mode: "explore",
        title: `${familyOnly.replace("_", " ")} only`,
        body: `Keeping the Italy fortnight, filtered to ${familyOnly.replace("_", " ")}.`,
      };
    }
    return {
      href: `/plan?collection=great-migrations&family=${familyOnly}`,
      mode: "plan",
      title: `${familyOnly.replace("_", " ")} only`,
      body: "Same year, narrower set.",
    };
  }

  if (wantsExplore) {
    const origin = originFrom(text);
    return {
      href: `/explore?origin=${origin}&from=2026-09-20&to=2026-10-04`,
      mode: "explore",
      title: `Explore from ${ORIGINS[origin].name}`,
      body: "Italy this fortnight — map, filters, and what’s in window.",
    };
  }

  return {
    href: null,
    mode: "ask",
    title: "I can plan or explore",
    body: "Try “show me a Planet Earth year of migrations” or “I’m in Italy the next two weeks.”",
  };
}

export const HOME_PROMPTS = [
  "I want to see all the great migrations covered in Planet Earth over a full calendar year",
  "I’m in Italy the next two weeks — what’s going on?",
  "From Venice, what’s worth a detour?",
];

export const PLAN_PROMPTS = [
  "Show me what’s in window this week",
  "Just the whale migrations",
  "I’m in Italy instead — what’s on?",
];

export const EXPLORE_PROMPTS = [
  "Switch my base to Rome",
  "Only wildlife",
  "Plan a year of migrations instead",
];
