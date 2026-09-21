import { readFile } from "node:fs/promises";
import { ENGINE_VERSION, type OccurrenceDraft } from "@serendipity/domain";
import { inputsHash, materialize, type MaterializeInput } from "@serendipity/domain/server";

type JobPayload = {
  seasonYears?: number[];
  rules: MaterializeInput[];
};

/**
 * P0 worker: read a JSON payload of rules and emit occurrences.
 * Persistence + incremental rule_materialization upserts land with the P1 seed job.
 */
async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: pnpm --filter @serendipity/jobs materialize <rules.json>");
    process.exit(1);
  }

  const payload = JSON.parse(await readFile(path, "utf8")) as JobPayload;
  const years = payload.seasonYears ?? [new Date().getUTCFullYear()];
  const rows: OccurrenceDraft[] = [];

  for (const item of payload.rules) {
    for (const seasonYear of years) {
      rows.push(...materialize({ ...item, seasonYear }));
    }
  }

  const report = {
    engineVersion: ENGINE_VERSION,
    inputsHash: inputsHash({ years, count: payload.rules.length }),
    rowCount: rows.length,
    occurrences: rows,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
