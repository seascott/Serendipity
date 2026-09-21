import type { PhenomenonSeed } from "../types";

export const phenomena: PhenomenonSeed[] = [
  {
    slug: "wildebeest-great-migration",
    name: "Great Wildebeest Migration",
    family: "wildlife",
    tags: ["migration", "safari", "planet-earth"],
    spectacle: 5,
    summary: "Two million animals follow the rains on an 1,800 km loop. River crossings peak in the Mara from late July.",
    description:
      "The Serengeti–Mara circuit is not a single stampede. Calves drop on the southern plains in January and February. The columns walk north as the short rains fail, reach the Grumeti, then the Mara River. August and early September are when the crossings bunch — a week of quiet, then a morning when the lead animals commit.",
    howToSee:
      "Base in the northern Serengeti or the Mara Triangle. Crossings are not scheduled; a good guide reads the river and the wind. Dawn and late afternoon. Stay at least three nights.",
    ethics:
      "Keep vehicles back from the banks. Do not block an animal that has committed to the water. No drones over crossings. The spectacle is the river deciding, not a staged charge.",
    practical: { guideRecommended: true, permit: "park fees" },
    sourceSlugs: ["kws-monitoring", "tanza-parks"],
    scene: { palette: ["#c4a46a", "#8a9e6e", "#2f4a3c"], texture: "field" },
  },
  {
    slug: "monarch-overwintering-michoacan",
    name: "Monarch Overwintering",
    family: "wildlife",
    tags: ["migration", "butterflies", "planet-earth"],
    spectacle: 5,
    summary: "Eastern monarchs carpet oyamel firs in Michoacán from November through March.",
    description:
      "Four generations fly north; one generation flies south. By mid-November the colonies have coalesced on a handful of high fir forests west of Mexico City. On a warm midday they lift in sheets. On a cold morning they hang like rusted leaves.",
    howToSee:
      "El Rosario and Sierra Chincua are the public sanctuaries. Ride or walk the last kilometres. Mid-morning after the sun hits the groves. Weekdays are quieter.",
    ethics:
      "Stay on marked trails. Do not touch clusters. The fir understory is the wintering habitat — keep voices low and groups small.",
    practical: { permit: "sanctuary ticket" },
    sourceSlugs: ["conanp-monarch"],
    scene: { palette: ["#c45c26", "#2f4a3c", "#f4efe4"], texture: "canopy" },
  },
  {
    slug: "gray-whale-baja-lagoons",
    name: "Gray Whale Lagoons",
    family: "wildlife",
    tags: ["migration", "whales", "planet-earth"],
    spectacle: 5,
    summary: "Mothers and calves in the Baja nursery lagoons, curious enough to approach a skiff.",
    description:
      "Gray whales swim from the Bering and Chukchi to three Pacific lagoons. San Ignacio remains the quietest. February and March are when calves are large enough to spyhop beside boats, and when the last northbound adults still linger.",
    howToSee:
      "Pangas from the cooperativos only. Half-day on the water. Bring a wind layer — the lagoon fetches.",
    ethics:
      "Engines idle near whales. No swimming. Mothers choose the approach; if she turns away, the boat does too.",
    practical: { needsBoat: true, guideRecommended: true },
    sourceSlugs: ["semarnat-whale"],
    scene: { palette: ["#4a7a88", "#f4efe4", "#1c1914"], texture: "water" },
  },
  {
    slug: "sardine-run-wild-coast",
    name: "Sardine Run",
    family: "wildlife",
    tags: ["migration", "ocean", "planet-earth"],
    spectacle: 5,
    summary: "A cold current herds sardines up the Wild Coast — sharks, gannets and dolphins in one bait-ball.",
    description:
      "The run is a pulse, not a parade. Water temperature, wind and the sardines themselves have to agree. June and July are the window; some years the action sits offshore, some years it boils in the first break.",
    howToSee:
      "Port St Johns and Coffee Bay are the usual launch points. Dive or snorkel boats work the bait-balls. Budget extra days — the ocean cancels.",
    ethics:
      "Do not break a bait-ball for a photograph. Give gannets and sharks the column. If you are not a strong ocean swimmer, watch from the cliffs.",
    practical: { needsBoat: true, guideRecommended: true },
    sourceSlugs: ["sa-tourism-sardine"],
    scene: { palette: ["#1c3a4a", "#c45c26", "#f4efe4"], texture: "water" },
  },
  {
    slug: "christmas-island-red-crabs",
    name: "Christmas Island Red Crabs",
    family: "wildlife",
    tags: ["migration", "planet-earth"],
    spectacle: 5,
    summary: "Tens of millions of red crabs walk to the sea on the first heavy rains of the wet season.",
    description:
      "The migration is timed to the moon and the rain. Crabs leave the forest, close the island's roads, release larvae on the turning tide, then walk home. Parks Australia publishes a watch when the first storms arrive.",
    howToSee:
      "Late October into November in a typical wet start. Drive slowly; the crabs have right of way. Dawn on the terrace forests.",
    ethics:
      "Never move a crab except off a wheel track. Lights and noise on the beaches during spawning are the usual harm.",
    sourceSlugs: ["christmas-island-parks"],
    scene: { palette: ["#6b2a22", "#2f4a3c", "#c45c26"], texture: "canopy" },
  },
  {
    slug: "sandhill-crane-platte-river",
    name: "Sandhill Cranes on the Platte",
    family: "wildlife",
    tags: ["migration", "birds", "planet-earth"],
    spectacle: 5,
    summary: "Half a million cranes roost on a few miles of braided river in March.",
    description:
      "The Central Flyway pinches at the Platte. From late February the birds stack on sandbars, then fan into corn stubble at dawn. Late March is peak density — a sound first, then a sky.",
    howToSee:
      "Rowe Sanctuary blinds at dawn and dusk. Book the blinds; roadside pull-offs work if you keep the car as a hide.",
    ethics:
      "Stay in blinds after last light. Flash and silhouettes flush the river. Give farmers' fields the same courtesy.",
    sourceSlugs: ["audubon-platte"],
    scene: { palette: ["#8a9e6e", "#d8c7a1", "#5c564c"], texture: "field" },
  },
  {
    slug: "sockeye-salmon-adams-river",
    name: "Adams River Sockeye",
    family: "wildlife",
    tags: ["migration", "salmon", "planet-earth"],
    spectacle: 4,
    summary: "A dominant-year run turns the Adams crimson in October.",
    description:
      "Sockeye return on a four-year drum. 2026 is a strong cycle year: the river fills from early October, peak colour in the second and third weeks. The Salish name and the science agree — this is a pulse, then it is gone.",
    howToSee:
      "Roderick Haig-Brown Park boardwalks. Mid-morning light on the riffles. Waterproof shoes; the banks are clay.",
    ethics:
      "Stay off redds. No wading through spawning pairs. Bears work these banks — give them the water.",
    sourceSlugs: ["dfo-adams"],
    scene: { palette: ["#6b2a22", "#2f4a3c", "#4a7a88"], texture: "water" },
  },
  {
    slug: "humpback-whales-hervey-bay",
    name: "Humpbacks in Hervey Bay",
    family: "wildlife",
    tags: ["migration", "whales", "planet-earth"],
    spectacle: 4,
    summary: "Northbound humpbacks rest in the lee of K'gari from late July through September.",
    description:
      "The bay is a classroom. Mothers teach calves in flat water. August is crowded with boats and with whales; September thins and the animals linger.",
    howToSee:
      "Licensed vessels from Urangan. Half-day is enough if the wind stays under 15 knots.",
    ethics:
      "Approach distances are enforced. Swim-with is a separate, tightly licensed product — do not freelance it.",
    practical: { needsBoat: true, guideRecommended: true },
    sourceSlugs: ["qld-humpback"],
    scene: { palette: ["#4a7a88", "#f4efe4", "#1c1914"], texture: "water" },
  },
  {
    slug: "western-arctic-caribou-crossing",
    name: "Western Arctic Caribou",
    family: "wildlife",
    tags: ["migration", "planet-earth"],
    spectacle: 4,
    summary: "The herd pinches through Onion Portage on the autumn walk toward the Kobuk.",
    description:
      "This is not a guaranteed spectacle. The Western Arctic herd chooses drainages. When they use Onion Portage, the river fills with antlers for a few days in early September.",
    howToSee:
      "Charter to Kobuk Valley. The park service posts crossing notes. Weather cancels more days than it allows.",
    ethics:
      "This is Iñupiaq hunting country. Give camps and hunters the bank. No low flights over a crossing column.",
    sourceSlugs: ["nps-kobuk"],
    scene: { palette: ["#8a9e6e", "#d8c7a1", "#1c1914"], texture: "ridge" },
  },
  {
    slug: "straw-coloured-fruit-bats-kasanka",
    name: "Kasanka Fruit Bats",
    family: "wildlife",
    tags: ["migration", "planet-earth"],
    spectacle: 5,
    summary: "The largest mammal migration on the continent — by headcount — fills a few hectares of swamp forest.",
    description:
      "From late October the mushitu canopy blackens. At dusk the column lifts for forty minutes. Peak density is mid-November. By Christmas the trees are ordinary again.",
    howToSee:
      "Fibwe hide at last light. Stay two nights. The park is small; the hide is the product.",
    ethics:
      "No lights into the roost. The forest floor is a latrine and a nursery — stay on the boardwalk.",
    sourceSlugs: ["kasanka-trust"],
    scene: { palette: ["#2f4a3c", "#1c1914", "#c45c26"], texture: "canopy" },
  },
  {
    slug: "zebra-migration-nxai-pan",
    name: "Nxai Pan Zebra Front",
    family: "wildlife",
    tags: ["migration", "planet-earth"],
    spectacle: 4,
    summary: "Zebras arrive with the first rains on the Boteti–Nxai route, December into February.",
    description:
      "Less filmed than the Mara, more of a weather bet. When the pans hold water the zebra front is a dark tide on white calcrete.",
    howToSee:
      "Nxai Pan camp after the first proper storm. December is early; January is the safer bet.",
    ethics:
      "Off-road driving scars the pans for years. Stay in tracks.",
    sourceSlugs: ["tanza-parks"],
    scene: { palette: ["#d8c7a1", "#8a6a3c", "#2f4a3c"], texture: "field" },
  },
  {
    slug: "horseshoe-crabs-red-knots-delaware",
    name: "Horseshoe Crabs & Red Knots",
    family: "wildlife",
    tags: ["migration", "planet-earth"],
    spectacle: 4,
    summary: "A full-moon spawn on Delaware Bay feeds birds that have flown from Tierra del Fuego.",
    description:
      "The crabs come up on the spring tides of late May. Red knots time a 15,000 km flight to those eggs. Two weeks, then the beach is ordinary sand again.",
    howToSee:
      "Slaughter Beach and Mispillion Harbor at night on the highest tides. Bring a dim red light.",
    ethics:
      "Stay off the wrack line. The knots are exhausted; a flushed flock can miss a feeding window.",
    sourceSlugs: ["dnrec-horseshoe"],
    scene: { palette: ["#c45c26", "#4a7a88", "#f4efe4"], texture: "water" },
  },
  {
    slug: "vendemmia-chianti",
    name: "Chianti Vendemmia",
    family: "activity",
    tags: ["harvest", "wine", "italy"],
    spectacle: 4,
    summary: "Sangiovese comes in from late August through early October. Mid-September is the crush.",
    description:
      "The vendemmia is work that looks like a festival from the road. Tractors in the rows, purple hands, the smell of must in every village. 2026 is running a few days early on the lower slopes.",
    howToSee:
      "Book a morning pick-and-lunch with a small estate south of Greve or Panzano. Afternoons are for the cellars.",
    ethics:
      "Vineyards are workplaces. Do not walk rows uninvited. Spit or sip — don't treat a working crush as a tasting room.",
    sourceSlugs: ["consorzio-chianti"],
    scene: { palette: ["#6b2a22", "#c45c26", "#8a9e6e"], texture: "vine" },
  },
  {
    slug: "vendemmia-nebbiolo-langhe",
    name: "Nebbiolo Harvest, Langhe",
    family: "activity",
    tags: ["harvest", "wine", "italy"],
    spectacle: 4,
    summary: "Nebbiolo hangs longer than sangiovese. The Langhe crush starts in the last days of September.",
    description:
      "Barolo and Barbaresco villages empty into the rows. Fog in the morning, gold in the afternoon. The first week of October is when the best-exposed slopes come in.",
    howToSee:
      "Alba or La Morra as a base. Estates take guests by appointment during harvest week.",
    sourceSlugs: ["consorzio-barolo"],
    scene: { palette: ["#3d2a1c", "#c45c26", "#d8c7a1"], texture: "vine" },
  },
  {
    slug: "white-truffle-piedmont",
    name: "White Truffle Season",
    family: "activity",
    tags: ["harvest", "food", "italy"],
    spectacle: 4,
    summary: "Tuber magnatum arrives with the first cool nights. The season opens in late September; it peaks later.",
    description:
      "Trifolaio and dog work the oak and linden woods after rain. The official season is long. The aromatic peak is usually mid-October through November. In the last ten days of September you are tasting the opening, not the climax.",
    howToSee:
      "Alba market mornings. A trifolaio walk is the honest version; a restaurant shaving is the easy one.",
    ethics:
      "Wild truffles are a regulated harvest. Do not follow a dog into private woods.",
    sourceSlugs: ["fiera-alba"],
    scene: { palette: ["#3d2a1c", "#d8c7a1", "#1c1914"], texture: "canopy" },
  },
  {
    slug: "alba-truffle-fair",
    name: "Alba White Truffle Fair",
    family: "cultural",
    tags: ["festival", "food", "italy"],
    spectacle: 3,
    summary: "The international fair fills Alba's weekends from mid-October.",
    description:
      "Cortile della Maddalena becomes a covered market of graded tartufi, cheese and Barolo. Saturdays and Sundays, mid-October to early December.",
    howToSee:
      "Arrive Saturday morning before the tour buses. The judging tables are the education.",
    sourceSlugs: ["fiera-alba"],
    scene: { palette: ["#c45c26", "#3d2a1c", "#f4efe4"], texture: "vine" },
  },
  {
    slug: "dolomites-larch-turn",
    name: "Dolomites Larch Turn",
    family: "seasonal_nature",
    tags: ["foliage", "italy"],
    spectacle: 4,
    summary: "European larch goes from green to coin-gold above Val di Funes in early October.",
    description:
      "Larch is a deciduous conifer. The colour is a week, maybe two, and it starts at elevation. Late September is the first hint; the second week of October is the postcard — if a storm has not stripped the needles.",
    howToSee:
      "Santa Maddalena meadows at 9 a.m. when the Odle still hold shadow. The Santa Croce walk is the high version.",
    sourceSlugs: ["provincia-bz"],
    scene: { palette: ["#c45c26", "#8a9e6e", "#5c564c"], texture: "ridge" },
  },
  {
    slug: "sagre-umbria-autumn",
    name: "Umbrian Autumn Sagre",
    family: "cultural",
    tags: ["festival", "food", "italy"],
    spectacle: 3,
    summary: "Village food festivals every weekend from September into November — wild boar, chestnuts, norcineria.",
    description:
      "A sagra is a town feeding itself in public. Long tables, paper cups, a saint or a harvest as the excuse. Umbria does this better than almost anywhere in the peninsula.",
    howToSee:
      "Pick a Saturday. Norcia, Spello, Bevagna and the mountain villages rotate. Eat what the handwritten menu says.",
    sourceSlugs: ["regione-umbria"],
    scene: { palette: ["#3d4a2c", "#c45c26", "#f4efe4"], texture: "canopy" },
  },
  {
    slug: "po-delta-autumn-passage",
    name: "Po Delta Autumn Passage",
    family: "wildlife",
    tags: ["birds", "migration", "italy"],
    spectacle: 3,
    summary: "Waterfowl and waders stack in the delta from mid-September. Spoonbill, flamingo, and the first geese.",
    description:
      "The Adriatic flyway pinches at the Po mouths. Mid-September to mid-October is the busy fortnight — not a single species spectacle, a density of wings.",
    howToSee:
      "Boat from Porto Tolle or hides at the Bertuzzi valleys. Dawn. Bring a scope if you have one.",
    ethics:
      "Stay in hides and marked boats. The delta is a working fishery as well as a park.",
    sourceSlugs: ["parco-po"],
    scene: { palette: ["#4a6a62", "#c9d4c0", "#1c1914"], texture: "water" },
  },
  {
    slug: "festa-delluva-impruneta",
    name: "Festa dell'Uva, Impruneta",
    family: "cultural",
    tags: ["festival", "wine", "italy"],
    spectacle: 3,
    summary: "Impruneta's grape festival fills a Sunday at the end of September — floats, chianti, the whole hill in the piazza.",
    description:
      "Four contrade build allegorical floats from flowers and grapes. The parade is the afternoon; the evening is the town drinking its own vintage.",
    howToSee:
      "Bus or taxi from Florence (40 minutes). Arrive before 14:00 for a place on the route.",
    sourceSlugs: ["comune-impruneta"],
    scene: { palette: ["#c45c26", "#f4efe4", "#2f4a3c"], texture: "vine" },
  },
  {
    slug: "porcini-apennines",
    name: "Porcini in the Apennines",
    family: "seasonal_nature",
    tags: ["forage", "italy"],
    spectacle: 3,
    summary: "Boletus after the first autumn rains. A week of plenty, then the woods go quiet.",
    description:
      "Porcini are a weather instrument. Warm days, cool nights, a soaking rain. Late September 2026 has the pattern. The woods above Norcia and the Casentino are the usual bet.",
    howToSee:
      "Go with someone who has a local permit and a knife. Markets in Norcia tell you if the week is real.",
    ethics:
      "Permits, quotas, and no rakes. Leave the buttons; take the open caps.",
    sourceSlugs: ["regione-umbria"],
    scene: { palette: ["#3d4a2c", "#8a9e6e", "#f4efe4"], texture: "canopy" },
  },
  {
    slug: "etna-summit-season",
    name: "Etna Summit Season",
    family: "activity",
    tags: ["volcano", "italy"],
    spectacle: 4,
    summary: "Guided high routes stay open through October. September light is the reason to go.",
    description:
      "The mountain makes its own weather. Summer crowds thin after Ferragosto. September and early October are when the scirocco is less constant and the lava fields hold the day's heat.",
    howToSee:
      "Cable car plus authorised guide above 2,500 m. Check the day's bulletin — closures are ordinary.",
    ethics:
      "Stay on marked high routes. The new lava is a crust, not a path.",
    practical: { guideRecommended: true, permit: "authorised guide above 2500 m" },
    sourceSlugs: ["parco-etna"],
    scene: { palette: ["#1c1914", "#c45c26", "#8a8376"], texture: "ridge" },
  },
  {
    slug: "olive-harvest-tuscany",
    name: "Tuscan Olive Harvest",
    family: "activity",
    tags: ["harvest", "italy"],
    spectacle: 3,
    summary: "Nets go down in late October. The new oil — olio nuovo — is a November taste.",
    description:
      "Olives hang after the grapes. Mid-October is early on most Chianti slopes; November is the crush. If you are here in the last week of September you are smelling the vineyards, not the frantoi.",
    howToSee:
      "A frantoio visit in November. In late September, walk the groves and book the later week.",
    sourceSlugs: ["consorzio-chianti"],
    scene: { palette: ["#8a9e6e", "#d8c7a1", "#1c1914"], texture: "vine" },
  },
  {
    slug: "september-equinox",
    name: "September Equinox",
    family: "astronomy",
    tags: ["sky", "equinox"],
    spectacle: 3,
    summary: "Equal day and night — the astronomical start of autumn in the north.",
    description:
      "The Sun crosses the celestial equator heading south. In Italy that is a late-September evening in civil time. Not a spectacle in the sky so much as a hinge in the year: harvest light, earlier dark, the first excuse for a jacket.",
    howToSee:
      "Sunset from any west-facing hill. The event is a clock, not a glow.",
    sourceSlugs: ["usno-sky"],
    scene: { palette: ["#191614", "#c45c26", "#f4efe4"], texture: "sky" },
  },
  {
    slug: "harvest-full-moon",
    name: "Harvest Full Moon",
    family: "astronomy",
    tags: ["sky", "moon"],
    spectacle: 3,
    summary: "The full moon nearest the September equinox — low, large, and useful to anyone still in the rows.",
    description:
      "Farmers named it because it rises close to sunset and stays useful. In 2026 it falls on 26 September. From a Tuscan ridge it clears the vines while the west is still salmon.",
    howToSee:
      "Any open eastern horizon. City centres wash it out; Fiesole or Chianti do not.",
    practical: { needsDarkSky: false },
    sourceSlugs: ["usno-sky"],
    scene: { palette: ["#191614", "#d8c7a1", "#c45c26"], texture: "sky" },
  },
];
