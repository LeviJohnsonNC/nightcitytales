import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LifeSceneContent } from "../LifeSceneContent";

it("keeps the outcome with the passage and ahead of the next action", () => {
  const html = renderToStaticMarkup(
    <LifeSceneContent
      lead="The market"
      narration="The stalls close."
      outcome="10 minutes elapsed"
      controls="Leave"
    />,
  );
  expect(html).toMatch(/The market.*The stalls close.*10 minutes elapsed.*Leave/);
});
