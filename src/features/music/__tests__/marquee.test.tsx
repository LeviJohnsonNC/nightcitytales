import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Marquee } from "../ncamp/parts";

describe("the title marquee", () => {
  const html = renderToStaticMarkup(<Marquee text="13. Night City Tales - Night City Wants You" />);

  it("starts as plain readable text, and scrolls only once it is measured to overflow", () => {
    expect(html).toContain("ncamp-marquee-still");
    expect(html).not.toContain("ncamp-marquee-track");
  });

  it("keeps the whole title for a screen reader either way", () => {
    expect(html).toContain('aria-label="13. Night City Tales - Night City Wants You"');
  });
});
