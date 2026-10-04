/**
 * The Favours tile. Server-rendered, so the sheet is closed: what is held here
 * is what the player sees before they open it — that the tile turns up only
 * where a place has taken to them, and never as a number.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FAVOUR_FLAG, startingState, type PlaceState } from "@/engine";
import { FavoursSheet } from "../FavoursSheet";
import type { LifeBundle } from "../lifeOps";

const CLINIC = "b11";

function welcomed(placeKey: string): PlaceState {
  const start = startingState(placeKey);
  return { ...start, flags: [...start.flags, FAVOUR_FLAG], dials: { ...start.dials, goodwill: 6 } };
}

function bundle(over: Partial<Record<string, unknown>> = {}): LifeBundle {
  return {
    phase: "life",
    campaign: { id: "c", day: 12, minute: 600, location_key: CLINIC },
    vitals: { hp_current: 20, hp_max: 35, eurobucks: 100 },
    character: { character: { role: "solo" }, stats: { body: 6 }, skills: [] },
    inventory: [],
    pressure: [],
    events: [],
    places: { [CLINIC]: welcomed(CLINIC) },
    ...over,
  } as unknown as LifeBundle;
}

const render = (b: LifeBundle) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <FavoursSheet bundle={b} />
    </QueryClientProvider>,
  );

describe("the Favours tile", () => {
  it("turns up where a place has taken to the character", () => {
    expect(render(bundle())).toContain("Favours");
  });

  it("is not there for a place that has not", () => {
    expect(render(bundle({ places: {} }))).toBe("");
  });

  it("is not there in the middle of a job's offer or a hook", () => {
    expect(render(bundle({ phase: "hook" }))).toBe("");
  });

  it("is not there on ground with nothing to offer", () => {
    // A place with no kind of favour its tags support offers nothing to ask for.
    expect(render(bundle({ campaign: { id: "c", day: 1, minute: 0, location_key: "z99" } }))).toBe(
      "",
    );
  });
});
