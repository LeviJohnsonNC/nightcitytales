import { Link } from "@tanstack/react-router";
import { FileText, MoreHorizontal } from "lucide-react";
import { CREATION_METHODS } from "@/engine";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import rolesData from "@/data/rules/roles.json";
import type { RosterEntry } from "@/lib/backend";
import { cn } from "@/lib/utils";
import { CharacterPortrait } from "./CharacterPortrait";
import { CharacterStats } from "./CharacterStats";
import { CharacterStatus } from "./CharacterStatus";

const ROLE_NAMES = rolesData.roles as unknown as Record<string, { name: string }>;

const METHOD_LABELS: Record<string, string> = {
  streetrat: CREATION_METHODS.streetrat.label,
  edgerunner: CREATION_METHODS.edgerunner.label,
  complete_package: CREATION_METHODS.completePackage.label,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CharacterCard({
  entry,
  selected,
  index,
  onSelect,
  onStart,
  onReset,
  onDelete,
  resetting,
  starting,
}: {
  entry: RosterEntry;
  selected: boolean;
  index: number;
  onSelect: () => void;
  onStart: () => void;
  onReset: () => void;
  onDelete: () => void;
  resetting: boolean;
  starting: boolean;
}) {
  const roleName = ROLE_NAMES[entry.role]?.name ?? entry.role;
  const continueLabel = entry.hasActiveCampaign ? "Continue Adventure" : "Start Adventure";
  const busyLabel = entry.hasActiveCampaign ? "Continuing…" : "Starting…";

  return (
    <article
      onMouseEnter={onSelect}
      onFocusCapture={onSelect}
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onSelect();
        }
      }}
      aria-label={`${entry.name}, ${roleName}`}
      className={cn(
        "group relative flex flex-col overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "animate-[fade-in_.5s_both] motion-reduce:animate-none",
        "border transition-[transform,border-color,box-shadow,background-color] duration-200 ease-out motion-reduce:transition-none",
        "bg-[linear-gradient(180deg,color-mix(in_oklab,var(--color-surface)_78%,transparent),color-mix(in_oklab,var(--color-ground)_88%,transparent))] backdrop-blur-md",
        selected
          ? "-translate-y-1 scale-[1.01] border-ember/70 shadow-[0_28px_60px_-24px_rgba(0,0,0,0.95),0_0_0_1px_color-mix(in_oklab,var(--color-neon-pink)_28%,transparent),0_0_46px_-18px_var(--color-neon-pink)]"
          : "border-hairline/70 shadow-[0_18px_44px_-28px_rgba(0,0,0,0.9)] hover:border-hairline",
      )}
      style={{ animationDelay: `${80 + index * 55}ms` }}
      aria-current={selected ? "true" : undefined}
    >
      {/* Top specular hairline. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px transition-opacity duration-200",
          selected
            ? "bg-[linear-gradient(90deg,transparent,var(--color-neon-pink),transparent)] opacity-100"
            : "bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--color-neon-cyan)_60%,transparent),transparent)] opacity-45",
        )}
      />

      <div className="relative w-full">
        <CharacterPortrait
          name={entry.name}
          handle={entry.handle}
          portraitId={entry.portrait_id}
          portraitPath={entry.portrait_path}
          emphasised={selected}
        />
      </div>


      <div className="relative -mt-8 flex flex-1 flex-col gap-4 px-5 pb-5">
        <header className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ember">{roleName}</p>
          <h3 className="truncate font-display text-2xl font-extrabold leading-tight tracking-tight text-text">
            {entry.name}
          </h3>
          <p className="truncate text-sm italic text-text-muted">
            {entry.handle ? `“${entry.handle}”` : "no street name"}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
            {METHOD_LABELS[entry.creation_method] ?? entry.creation_method}
          </p>
        </header>

        <CharacterStats
          hpCurrent={entry.stats?.hp_current}
          hpMax={entry.stats?.hp_max}
          humanityCurrent={entry.stats?.humanity_current}
          humanityMax={entry.stats?.humanity_max}
        />

        <CharacterStatus live={entry.hasActiveCampaign} />

        <div className="mt-auto space-y-3 pt-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-text-dim/70">
            Created {formatDate(entry.created_at)}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onStart}
              disabled={starting}
              className={cn(
                "flex-1 cursor-pointer px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em]",
                "transition-all duration-200 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "bg-ember text-primary-foreground shadow-[0_0_28px_-8px_var(--color-neon-pink)] hover:bg-ember-deep"
                  : "border border-hairline bg-surface/40 text-text-muted hover:border-ember/70 hover:text-text",
              )}
            >
              {starting ? busyLabel : continueLabel}
            </button>

            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/character/$id"
                    params={{ id: entry.id }}
                    aria-label={`Open ${entry.name}'s sheet`}
                    className="flex h-[38px] w-[38px] items-center justify-center border border-hairline text-text-muted transition-colors hover:border-cool/70 hover:text-cool focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <FileText className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Open sheet</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`More actions for ${entry.name}`}
                className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center border border-transparent text-text-dim transition-colors hover:border-hairline hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onReset} disabled={resetting}>
                  {resetting ? "Resetting…" : "Reset adventure"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onDelete} className="text-destructive">
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </article>
  );
}
