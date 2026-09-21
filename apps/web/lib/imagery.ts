export const IMAGERY_SLUGS = new Set([
  "wildebeest-great-migration",
  "monarch-overwintering-michoacan",
  "gray-whale-baja-lagoons",
  "sardine-run-wild-coast",
  "sandhill-crane-platte-river",
  "vendemmia-chianti",
  "white-truffle-piedmont",
  "dolomites-larch-turn",
  "po-delta-autumn-passage",
  "harvest-full-moon",
  "etna-summit-season",
]);

export function imagerySrc(slug: string): string | null {
  return IMAGERY_SLUGS.has(slug) ? `/imagery/${slug}.jpg` : null;
}
