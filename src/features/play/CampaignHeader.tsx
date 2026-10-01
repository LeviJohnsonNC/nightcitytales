import type { ReactNode } from "react";
import { PlayerStrip } from "@/features/music/PlayerStrip";
import { cn } from "@/lib/utils";

/**
 * The top of Life and of a job: the campaign's name, where it is, and the map
 * and sheet buttons, with the player in a strip under them.
 *
 * Both screens had their own copy of this, differing only in whether it sticks.
 * `className` carries that (and the background that goes with it); everything
 * else — the desktop's rule under it and its padding, the player — is here, so
 * the two cannot drift. The player sits INSIDE it so that wherever the header
 * stays in view, the player does.
 */
export function CampaignHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  actions: ReactNode;
  className?: string | undefined;
}) {
  return (
    <header className={cn("lg:-mx-4 lg:border-b lg:border-border lg:px-4 lg:py-3", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          {subtitle}
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <PlayerStrip />
    </header>
  );
}
