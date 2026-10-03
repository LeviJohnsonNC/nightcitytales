import { expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { northHeywoodScene } from "@/engine";
import { SceneContact } from "../SceneContact";
function render(status: "ready" | "resolved") {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(["scene", "c", "north_heywood", "life"], {
    id: "s",
    campaignId: "c",
    revision: status === "ready" ? 0 : 2,
    status,
    scene: northHeywoodScene(),
    encounterId: status === "ready" ? null : "e",
    summary: status === "ready" ? null : "The lookout withdrew. The cruiser door is destroyed.",
  });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <SceneContact campaignId="c" location="north_heywood" phase="life" />
    </QueryClientProvider>,
  );
}
it("offers entry for a staged scene", () => {
  expect(render("ready")).toContain("Enter combat");
});
it("leaves the aftermath to the main narrative without repeating it or offering a respawn", () => {
  const html = render("resolved");
  expect(html).toBe("");
  expect(html).not.toContain("Enter combat");
});
