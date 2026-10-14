/**
 * The shared plate and the faces built on it, as markup. What a browser does
 * with the layout is checked by looking (see docs/checkpoint-faces-layout.md);
 * this holds what the markup says: which picture, what a screen reader hears,
 * and what happens when there is no picture.
 */
import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FacePlate } from "../FacePlate";
import { initialsOf } from "../faceInitials";
import { NpcFace, NpcName } from "../NpcName";
import { findNpc } from "../npcDirectory";
import { SceneFaces } from "@/features/life/SceneFaces";
import { sceneFaces } from "@/features/life/sceneFaces";

it("draws a picture when it has one, and initials when it has none", () => {
  expect(renderToStaticMarkup(<FacePlate src="/a.webp" name="Ilsa Bräun" />)).toContain(
    'src="/a.webp"',
  );
  const bare = renderToStaticMarkup(<FacePlate src={null} name="Mama Ishii" />);
  expect(bare).not.toContain("<img");
  expect(bare).toContain("MI");
});

it("makes initials from the first and last word, and survives a name with no letters", () => {
  expect(initialsOf('Marcus "Tally" Oyelaran')).toBe("MO");
  expect(initialsOf("Dot")).toBe("DO");
  expect(initialsOf("")).toBe("?");
});

it("shows a person's face with their name only, and says how they read to a screen reader", () => {
  const html = renderToStaticMarkup(<NpcFace npc={findNpc("Ilsa Bräun")!} />);
  expect(html).toContain("/images/cast/ilsa-braun");
  expect(html).toContain("Ilsa Bräun");
  expect(html).not.toContain("Fixer");
  expect(html).toContain('alt="Ilsa Bräun, woman, middle-aged"');
});

it("keeps a name as text: no thumbnail in front of it any more", () => {
  const html = renderToStaticMarkup(
    <NpcName name="Ilsa Bräun" card>
      Ilsa Bräun
    </NpcName>,
  );
  expect(html).toContain("Open dossier for Ilsa Bräun");
  expect(html).not.toContain("<img");
});

it("renders a name it does not know as plain text", () => {
  expect(renderToStaticMarkup(<NpcName name="Nobody At All" />)).toBe("Nobody At All");
});

it("lays the scene's faces out as a labelled row, and draws nothing for an empty scene", () => {
  const faces = sceneFaces({
    text: "Ilsa Bräun is here.",
    walkOns: [{ subject: "dive-bar-tender", gender: "female" }],
    people: [],
  });
  const html = renderToStaticMarkup(<SceneFaces faces={faces} />);
  expect(html).toContain('aria-label="Who is here"');
  expect(html).toContain("Ilsa Bräun");
  expect(html).toContain("Dive Bar Tender");
  // The caption is the role alone; how they read stays in the alt text.
  expect(html).not.toContain(">woman, older<");
  expect(html).toContain("woman, older");
  expect(renderToStaticMarkup(<SceneFaces faces={[]} />)).toBe("");
});

it("puts a learned name over a walk-on's role, in the cast's own type, and says both to a screen reader", () => {
  const faces = sceneFaces({
    text: "",
    walkOns: [{ subject: "dive-bar-tender", gender: "female", name: "Mara Ketter" }],
    people: [],
  });
  const html = renderToStaticMarkup(<SceneFaces faces={faces} />);
  expect(html).toContain("Mara Ketter");
  expect(html).toContain("Dive Bar Tender");
  expect(html.indexOf("Mara Ketter")).toBeLessThan(html.indexOf("Dive Bar Tender"));
  expect(html).toContain("font-semibold");
  expect(html).toContain("Mara Ketter, Dive Bar Tender");
});

it("draws the face a walk-on was given, and the original when it was stored without one", () => {
  const faces = sceneFaces({
    text: "",
    walkOns: [
      { subject: "dive-bar-tender", gender: "female", face: "dive-bar-tender-female-young" },
      { subject: "ncpd-beat-cop", gender: "male" },
    ],
    people: [],
  });
  const html = renderToStaticMarkup(<SceneFaces faces={faces} />);
  expect(html).toContain("/images/flavor/dive-bar-tender-female-young-face.webp");
  expect(html).not.toContain("/images/flavor/dive-bar-tender-female-face.webp");
  expect(html).toContain("/images/flavor/ncpd-beat-cop-male-face.webp");
  expect(html).toContain("woman, young");
});
