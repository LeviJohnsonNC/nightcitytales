/**
 * The Screamsheet's dock tile and its cards. Server-rendered, so the sheet is
 * closed: what is held here is what the player sees BEFORE they open it — the
 * count of what they have not read — and how one headline is set.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { placeChangedEventData, screamsheet } from "@/engine";
import { ScreamsheetItem } from "@/features/status/ScreamsheetItem";
import { ScreamsheetSheet } from "../ScreamsheetSheet";

let seq = 0;
const row = (type: string, data: unknown) => ({ id: `e${(seq += 1)}`, seq, type, data });
const items = screamsheet({
  handle: "Velvet",
  events: [
    row(
      "place_changed",
      placeChangedEventData({ placeKey: "a1", flag: "raided", set: true, day: 4 }),
    ),
    row(
      "place_changed",
      placeChangedEventData({ placeKey: "a2", flag: "shut", set: true, day: 5 }),
    ),
  ],
});

const bundle = (sheet: typeof items, id = "c1") => ({ campaign: { id }, sheet }) as never;

describe("the dock tile", () => {
  it("counts what the reader has not read, and says nothing when there is nothing", () => {
    const html = renderToStaticMarkup(<ScreamsheetSheet bundle={bundle(items)} />);
    expect(html).toContain("The Sheet");
    expect(html).toContain("2 new");
    const quiet = renderToStaticMarkup(<ScreamsheetSheet bundle={bundle([], "c2")} />);
    expect(quiet).toContain("The Sheet");
    expect(quiet).not.toContain(" new");
  });
});

describe("the count", () => {
  it("is a count, not a wall: past nine it says so", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      row(
        "place_changed",
        placeChangedEventData({ placeKey: "a1", flag: "raided", set: true, day: i + 1 }),
      ),
    );
    const html = renderToStaticMarkup(
      <ScreamsheetSheet bundle={bundle(screamsheet({ handle: "V", events: many }), "c3")} />,
    );
    expect(html).toContain("9+ new");
    expect(html).not.toContain("12 new");
  });
});

describe("one headline", () => {
  const item = items[0]!;

  it("sets a kicker, a headline, the line under it, and a place that opens its entry", () => {
    const html = renderToStaticMarkup(<ScreamsheetItem item={item} />);
    expect(html).toContain(item.kicker);
    expect(html).toContain(item.headline.replace(/&/g, "&amp;").replace(/’/g, "’"));
    expect(html).toContain('data-kind="place"');
    expect(html).toContain("Open the atlas entry for");
  });

  it("marks what is new, and treats a cutting as a cutting", () => {
    expect(renderToStaticMarkup(<ScreamsheetItem item={item} isNew />)).toContain("New");
    expect(renderToStaticMarkup(<ScreamsheetItem item={item} />)).not.toMatch(/>New</);
    expect(renderToStaticMarkup(<ScreamsheetItem item={item} clipping />)).toContain(
      "border-dashed",
    );
  });

  it("prints no place line for a headline with no place to point at", () => {
    const html = renderToStaticMarkup(
      <ScreamsheetItem item={{ ...item, placeName: null, placeKey: null }} />,
    );
    expect(html).not.toContain("atlas entry");
  });
});
