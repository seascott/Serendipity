import type { CollectionSeed, PairSeed } from "../types";

export const collections: CollectionSeed[] = [
  {
    slug: "great-migrations",
    title: "A Planet Earth Year",
    kicker: "Wildlife · the great circuits",
    intro:
      "The migrations a natural-history year actually covers — not a bucket list, a calendar. Click a row to see when the window opens, where to stand, and how to be there without harm.",
    phenomenonSlugs: [
      "wildebeest-great-migration",
      "monarch-overwintering-michoacan",
      "gray-whale-baja-lagoons",
      "sardine-run-wild-coast",
      "christmas-island-red-crabs",
      "sandhill-crane-platte-river",
      "sockeye-salmon-adams-river",
      "humpback-whales-hervey-bay",
      "western-arctic-caribou-crossing",
      "straw-coloured-fruit-bats-kasanka",
      "zebra-migration-nxai-pan",
      "horseshoe-crabs-red-knots-delaware",
    ],
    defaultYear: 2026,
  },
];

export const pairs: PairSeed[] = [
  {
    slug: "vendemmia-in-chianti",
    phenomenonSlug: "vendemmia-chianti",
    placeSlug: "chianti",
    intro: "How to be in the rows for the sangiovese crush without getting in the way.",
  },
  {
    slug: "truffle-in-alba",
    phenomenonSlug: "white-truffle-piedmont",
    placeSlug: "alba-langhe",
    intro: "Opening week is not peak week — here is how the season actually unfolds.",
  },
  {
    slug: "wildebeest-in-masai-mara",
    phenomenonSlug: "wildebeest-great-migration",
    placeSlug: "masai-mara",
    intro: "River crossings are a weather and a river decision, not a date on a brochure.",
  },
  {
    slug: "monarchs-in-michoacan",
    phenomenonSlug: "monarch-overwintering-michoacan",
    placeSlug: "el-rosario",
    intro: "The colonies are a forest, not a butterfly house.",
  },
  {
    slug: "cranes-on-the-platte",
    phenomenonSlug: "sandhill-crane-platte-river",
    placeSlug: "platte-kearney",
    intro: "Dawn blinds on a braided river that holds half a million birds.",
  },
];
