/**
 * The top of Life and of a job, now shared, and the phone's status bar that
 * carries the player. Server-rendered, where there is no viewport: the player
 * is the desktop's to mount, so the header draws without it and the phone's bar
 * draws with it.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CampaignHeader } from "../CampaignHeader";
import { MobileStatusBar } from "../mobileShell";

describe("the campaign header", () => {
  const html = renderToStaticMarkup(
    <CampaignHeader
      title="Sundown in Night City"
      subtitle={<p>Life · 21:30 · day 1</p>}
      actions={<button>Map</button>}
      className="lg:sticky lg:top-0"
    />,
  );

  it("names the campaign once, says where it is, and holds the buttons", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("Sundown in Night City");
    expect(html).toContain("Life · 21:30 · day 1");
    expect(html).toContain("<button>Map</button>");
  });

  it("takes its stickiness from the screen, and keeps the rule and padding for itself", () => {
    expect(html).toContain("lg:sticky lg:top-0");
    expect(html).toContain("lg:border-b");
    expect(html).toContain("lg:px-4");
  });

  it("leaves the player to the desktop: a phone's has its own bar", () => {
    expect(html).not.toContain("data-player-strip");
    expect(html).not.toContain("ncamp");
  });
});

describe("the phone's status bar", () => {
  const html = renderToStaticMarkup(
    <MobileStatusBar title="Mara Vance" chips={[{ label: "HP", value: "34" }]}>
      <p>the rail</p>
    </MobileStatusBar>,
  );

  it("still shows the numbers, behind one button that opens the rest", () => {
    expect(html).toContain("HP");
    expect(html).toContain("34");
    expect(html.match(/aria-label="Mara Vance — open full status"/g)).toHaveLength(1);
  });

  it("carries the player beside that button, never inside it: a button cannot hold buttons", () => {
    expect(html).toContain("data-player-strip");
    const trigger = html.indexOf('aria-label="Mara Vance — open full status"');
    const closes = html.indexOf("</button>", trigger);
    const player = html.indexOf("ncamp", trigger);
    expect(player).toBeGreaterThan(closes);
  });

  it("is the sticky one, and is gone on the desktop", () => {
    expect(html).toContain("sticky top-0");
    expect(html).toContain("lg:hidden");
  });
});
