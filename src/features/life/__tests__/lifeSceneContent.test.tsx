import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LifeSceneContent } from "../LifeSceneContent";

it("puts the current scene and its controls before collapsed older narration", () => {
  const html = renderToStaticMarkup(
    <LifeSceneContent
      narration={<p>Ulysses Street intersection</p>}
      controls={<button>Enter combat</button>}
      history={<p>Earlier container home</p>}
    />,
  );
  expect(html.indexOf("Ulysses Street")).toBeLessThan(html.indexOf("Enter combat"));
  expect(html.indexOf("Enter combat")).toBeLessThan(html.indexOf("<details"));
  expect(html.indexOf("<details")).toBeLessThan(html.indexOf("Earlier container home"));
  expect(html).not.toMatch(/<details[^>]*\bopen/);
});
it("keeps aftermath prominent and retains older events without duplicating them", () => {
  const html = renderToStaticMarkup(
    <LifeSceneContent
      narration={<p>Both gangers withdrew.</p>}
      history={<p>Before the fight</p>}
    />,
  );
  expect(html.indexOf("Both gangers withdrew.")).toBeLessThan(html.indexOf("<details"));
  expect(html.match(/Both gangers withdrew/g)).toHaveLength(1);
});
it("does not hide the only available narration while a current block is absent", () => {
  const html = renderToStaticMarkup(<LifeSceneContent narration={null} history={<p>Opening</p>} />);
  expect(html).toContain("Opening");
  expect(html).not.toContain("<details");
});
