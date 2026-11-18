import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PeopleStrip, type HudPerson } from "../PeopleStrip";

// Inspect the contents normally mounted into a browser portal.
vi.mock("@/components/ui/sheet", async (original) => ({
  ...(await original<typeof import("@/components/ui/sheet")>()),
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

const person = (
  key: string,
  name: string,
  disposition: number,
  lastSeenDay?: number,
): HudPerson => ({
  key,
  name,
  disposition,
  standing: `${name} standing line`,
  known: ["a thing you learned"],
  lastSeenDay,
});

describe("the people strip", () => {
  const people = [
    person("1", "Alpha One", 2, 9),
    person("2", "Bravo Two", 0, 8),
    person("3", "Charlie Three", -2, 7),
    person("4", "Delta Four", 1, 6),
    person("5", "Echo Five", 0, 5),
    person("6", "Foxtrot Six", 3, 1),
  ];
  const html = renderToStaticMarkup(<PeopleStrip people={people} standings={[]} />);

  it("keeps every known contact and their learned facts in Contacts", () => {
    expect(html).toContain(">Contacts<");
    expect(html).toContain(">Foxtrot Six<");
    expect(html).toContain("a thing you learned");
    expect(html).toContain("Alpha One standing line");
  });

  it("opens a person with a dossier at full size, and keeps the small card for anybody without one", () => {
    const withDossier = renderToStaticMarkup(
      <PeopleStrip
        people={[person("1", "Nnamdi Cole", 2, 9), person("2", "Nobody Known", 0, 8)]}
        standings={[]}
      />,
    );
    expect(withDossier).toContain('aria-label="Open dossier for Nnamdi Cole"');
    expect(withDossier).toContain(">Nobody Known<");
    expect(withDossier).not.toContain('aria-label="Open dossier for Nobody Known"');
  });

  it("keeps Contacts available before the first introduction", () => {
    expect(renderToStaticMarkup(<PeopleStrip people={[]} standings={[]} />)).toContain(
      "Your contacts will appear",
    );
  });
});
