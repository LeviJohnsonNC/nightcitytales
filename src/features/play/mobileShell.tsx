/**
 * Phone ergonomics for the two play surfaces.
 *
 * Purely presentational: on a narrow screen the side rail is unreachable at the
 * bottom of a long log, so it becomes a condensed sticky strip at the top with
 * the full rail one tap away, and the action input docks to the thumb. On `lg`
 * and up both of these disappear and the original desktop layout stands.
 */
import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export type StatChip = { label: string; value: string };

/** The numbers you check every turn, always in reach. Tap for the whole rail. */
export function MobileStatusBar({
  title,
  chips,
  children,
}: {
  title: string;
  chips: StatChip[];
  children: ReactNode;
}) {
  return (
    <div
      className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur lg:hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-4 overflow-x-auto px-4 py-2 text-left"
            aria-label={`${title} — open full status`}
          >
            {chips.map((chip) => (
              <span key={chip.label} className="flex shrink-0 items-baseline gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {chip.label}
                </span>
                <span className="num text-sm font-bold">{chip.value}</span>
              </span>
            ))}
            <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
              Status ▾
            </span>
          </button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">{children}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/**
 * The action input, docked above the on-screen keyboard on a phone and left
 * exactly where it was on a desktop.
 */
export function BottomDock({ children }: { children: ReactNode }) {
  return (
    <div
      className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-background/95 px-4 pt-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-0 lg:backdrop-blur-none"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      {children}
    </div>
  );
}
