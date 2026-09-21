import { describe, expect, it } from "vitest";
import { interpretJourney } from "../lib/intent";

function originOf(href: string | null): string | null {
  return href ? new URL(href, "http://x").searchParams.get("origin") : null;
}

describe("interpretJourney explore origin", () => {
  it("defaults to Florence with no context and no city", () => {
    const intent = interpretJourney("I'm in Italy the next two weeks — what's going on?");
    expect(intent.mode).toBe("explore");
    expect(originOf(intent.href)).toBe("florence");
  });

  it("keeps the current Explore origin when no city is mentioned", () => {
    const intent = interpretJourney("what's going on nearby?", { mode: "explore", origin: "venice" });
    expect(intent.mode).toBe("explore");
    expect(originOf(intent.href)).toBe("venice");
    expect(intent.title).toBe("Explore from Venice");
  });

  it("lets an explicit city override the current origin", () => {
    const intent = interpretJourney("Switch my base to Rome", { mode: "explore", origin: "venice" });
    expect(originOf(intent.href)).toBe("rome");
    expect(interpretJourney("Firenze instead", { mode: "explore", origin: "rome" }).href).toContain("origin=florence");
  });

  it("does not inherit an origin from Plan mode", () => {
    const intent = interpretJourney("I'm in Italy instead — what's on?", { mode: "plan" });
    expect(originOf(intent.href)).toBe("florence");
  });

  it("keeps origin and family together for a filtered explore", () => {
    const intent = interpretJourney("only wildlife nearby", { mode: "explore", origin: "rome" });
    const query = new URL(intent.href!, "http://x").searchParams;
    expect(query.get("origin")).toBe("rome");
    expect(query.get("family")).toBe("wildlife");
  });
});
