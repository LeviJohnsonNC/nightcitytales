import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PeopleStrip, type HudPerson } from "../PeopleStrip";

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

  it("shows five faces and leaves the sixth for 'all'", () => {
    expect(html).toContain('aria-label="Echo Five"');
    expect(html).not.toContain('aria-label="Foxtrot Six"');
    expect(html).toContain("Everyone you know");
  });

  it("keeps what each person is carrying behind a tap", () => {
    expect(html).not.toContain("a thing you learned");
    expect(html).not.toContain("standing line");
  });

  it("opens a person with a dossier at full size, and keeps the small card for anybody without one", () => {
    const withDossier = renderToStaticMarkup(
      <PeopleStrip
        people={[person("1", "Nnamdi Cole", 2, 9), person("2", "Nobody Known", 0, 8)]}
        standings={[]}
      />,
    );
    expect(withDossier).toContain('aria-label="Open dossier for Nnamdi Cole"');
    expect(withDossier).toContain('aria-label="Nobody Known"');
    expect(withDossier).not.toContain('aria-label="Open dossier for Nobody Known"');
  });

  it("draws nothing when there is nobody and nothing to stand on", () => {
    expect(renderToStaticMarkup(<PeopleStrip people={[]} standings={[]} />)).toBe("");
  });
});
