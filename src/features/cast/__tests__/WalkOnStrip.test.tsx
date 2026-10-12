import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WalkOnStrip } from "../WalkOnStrip";

const strip = (props: Parameters<typeof WalkOnStrip>[0]) =>
  renderToStaticMarkup(<WalkOnStrip {...props} />);

it("shows the cut face, not the whole scene, beside the line of narration", () => {
  const html = strip({
    walkOns: [{ subject: "dive-bar-tender", gender: "female" }],
    defaultOpen: true,
  });
  expect(html).toContain('src="/images/flavor/dive-bar-tender-female-face.webp"');
  // The scene itself is for the dialog, not the strip.
  expect(html).not.toContain('src="/images/flavor/dive-bar-tender-female.webp"');
});

it("captions each face with its role and how it reads, as a band and never a number", () => {
  const html = strip({
    walkOns: [
      { subject: "dive-bar-tender", gender: "female" },
      { subject: "ncpd-beat-cop", gender: "male" },
    ],
    defaultOpen: true,
  });
  expect(html).toContain("woman, older");
  expect(html).toContain("man, middle-aged");
  expect(html).not.toMatch(/>\s*\d+\s*</);
});

it("keeps the picture's description for a screen reader", () => {
  const html = strip({
    walkOns: [{ subject: "ncpd-beat-cop", gender: "male" }],
    defaultOpen: true,
  });
  expect(html).toContain('alt="Ncpd Beat Cop, man, middle-aged"');
});

it("draws nothing for no walk-ons, and nothing for a subject with no art", () => {
  expect(strip({ walkOns: [] })).toBe("");
  const html = strip({ walkOns: [{ subject: "not-a-role", gender: "male" }], defaultOpen: true });
  expect(html).not.toContain("<img");
});
