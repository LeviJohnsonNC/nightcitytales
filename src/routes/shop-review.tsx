import { createFileRoute } from "@tanstack/react-router";
import { ShopReview } from "@/features/dev/ShopReview";

/** Public static fixtures, like /scene-review. No accounts, database, model calls or writes. */
export const Route = createFileRoute("/shop-review")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Shop review · Night City Tales" }, { name: "robots", content: "noindex" }],
  }),
  component: ShopReview,
});
