/**
 * The face behind a counter: their portrait once it has landed, their
 * initials until then. Presentation only; who they are is `useShop`'s keeper.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CounterKeeper } from "../useShop";

/** Two letters for the stand-in: "Mama Ishii" → MI, "Dot" → DO. */
export function initials(name: string): string {
  const words = name.split(/[\s&]+/).filter((w) => /[a-z]/i.test(w));
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w.replace(/[^a-z]/gi, "")[0]!.toUpperCase())
    .join("");
}

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
  const [failed, setFailed] = useState(false);
  const image = failed ? null : (keeper?.image ?? null);
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden border border-accent/50 bg-[radial-gradient(circle_at_50%_30%,rgba(161,92,255,0.35),rgba(13,10,31,0.95)_70%)]",
        className,
      )}
    >
      {image ? (
        <img
          src={image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-top"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center font-display text-lg font-extrabold text-accent"
        >
          {initials(keeper?.name ?? fallback)}
        </span>
      )}
    </div>
  );
}
