/**
 * The face behind a counter: their portrait once it has landed, their
 * initials until then. Presentation only; who they are is `useShop`'s keeper.
 */
import { FacePlate } from "@/features/cast/FacePlate";
import type { CounterKeeper } from "../useShop";

export function KeeperFace({
  keeper,
  fallback,
  className,
}: {
  keeper: CounterKeeper | null;
  /** What to draw initials from when nobody is named (the shop's own name). */
  fallback: string;
  className?: string;
}) {
  return (
    <FacePlate
      src={keeper?.image ?? null}
      name={keeper?.name ?? fallback}
      ringClass="border-accent/50"
      {...(className ? { className } : {})}
    />
  );
}
