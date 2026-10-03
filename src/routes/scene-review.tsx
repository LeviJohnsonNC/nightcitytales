import { createFileRoute } from "@tanstack/react-router";
import { SceneReview } from "@/features/dev/SceneReview";

/** Public static fixtures, like /style. No accounts, database, model calls or writes. */
export const Route = createFileRoute("/scene-review")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Scene review · Night City Tales" }, { name: "robots", content: "noindex" }],
  }),
  component: SceneReview,
});
