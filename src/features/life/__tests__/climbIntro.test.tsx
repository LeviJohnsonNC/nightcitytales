import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ClimbIntro } from "../ClimbIntro";

describe("the day-one pointer at Within reach", () => {
  it("says what there is to climb and offers to show it", () => {
    const html = renderToStaticMarkup(
      <ClimbIntro campaignId="c1" pinnedCount={0} onShow={() => {}} />,
    );
    expect(html).toContain("within reach");
    expect(html).toContain("Show me");
  });

  it("is gone once the player is working toward something", () => {
    expect(
      renderToStaticMarkup(<ClimbIntro campaignId="c1" pinnedCount={1} onShow={() => {}} />),
    ).toBe("");
  });
});
