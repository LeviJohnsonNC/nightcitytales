/**
 * The Role Ability, opened.
 *
 * Clicked from the Role page, where it is otherwise one word on the right of a
 * row. In the order somebody falls for a power: what it is in one line, a
 * moment of it working, and where it goes from the Rank you start at to Rank
 * 10 — the Ranks you will hold on day one lit, the rest ahead of you. The
 * engine's own first-night figures and the printed rule sit under it for
 * somebody who is already sold and wants the numbers.
 */
import { useState } from "react";
import rolesData from "@/data/rules/roles.json";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { roleOpening } from "@/engine";
import { cn } from "@/lib/utils";
import { ArtSlot } from "./ArtSlot";
import { roleArt } from "./art";
import { ROLE_ABILITY_SHOWCASE } from "./roleAbilityShowcase";
import "./interview.css";

const MAX_RANK = 10;

export type ModalRole = {
  id: string;
  name: string;
  roleAbility: { name: string; startingRank: number; mechanicalText: string };
};

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Ten cells, the starting Ranks lit and pulsing in sequence as the modal opens. */
function RankMeter({ start }: { start: number }) {
  return (
    <div aria-label={`Starts at Rank ${start} of ${MAX_RANK}`} className="space-y-2">
      <div className="flex gap-1">
        {Array.from({ length: MAX_RANK }, (_, i) => {
          const lit = i < start;
          return (
            <span
              key={i}
              aria-hidden
              style={{ animationDelay: `${300 + i * 70}ms` }}
              className={cn(
                "cg-rank-cell h-2 flex-1",
                lit ? "bg-primary shadow-[0_0_12px_-2px_var(--color-primary)]" : "bg-border",
              )}
            />
          );
        })}
      </div>
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.2em]">
        <span className="text-primary">You start at Rank {start}</span>
        <span className="text-muted-foreground">Rank {MAX_RANK}</span>
      </div>
    </div>
  );
}

export function RoleAbilityModal({
  role,
  open,
  onOpenChange,
}: {
  role: ModalRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const showcase = ROLE_ABILITY_SHOWCASE[role.id];
  const start = role.roleAbility.startingRank;
  const opening = roleOpening(role.id, start);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto overflow-x-hidden border-primary/40 p-0 sm:max-w-3xl sm:rounded-none">
        {/* The hero: the Role's own art, the name of the power over it. */}
        <div className="relative h-56 overflow-hidden sm:h-72">
          <ArtSlot
            art={roleArt(role.id, role.name)}
            label={role.name}
            className="cg-ken-burns border-0"
            focalOverride={[0.5, 0.2]}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/0" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_100%,color-mix(in_oklab,var(--color-primary)_35%,transparent),transparent_60%)] mix-blend-screen" />
          <div className="absolute inset-x-0 bottom-0 space-y-2 p-5 sm:p-8">
            <Eyebrow className="text-accent">The {role.name}'s Role Ability</Eyebrow>
            <DialogTitle
              key={role.id}
              className="cg-glitch font-display text-5xl font-bold uppercase leading-none tracking-tight sm:text-7xl"
            >
              {role.roleAbility.name}
            </DialogTitle>
          </div>
        </div>

        <div className="space-y-8 p-5 sm:p-8">
          {showcase && (
            <DialogDescription className="cg-say text-xl font-semibold leading-snug text-foreground sm:text-2xl">
              {showcase.pitch}
            </DialogDescription>
          )}

          {showcase && (
            <figure
              className="cg-say relative border-l-2 border-accent bg-accent/5 py-4 pl-5 pr-4"
              style={{ animationDelay: "150ms" }}
            >
              <Eyebrow className="mb-2 text-accent">Picture it</Eyebrow>
              <blockquote className="text-base italic leading-relaxed text-foreground/90 sm:text-lg">
                {showcase.moment}
              </blockquote>
            </figure>
          )}

          {opening?.unbuilt && (
            <p className="border border-amber/50 bg-amber/10 p-3 text-sm text-foreground">
              Honest warning: the Net is not playable yet. The GM plays {role.roleAbility.name} in
              the fiction until it is.
            </p>
          )}

          <section className="space-y-4">
            <RankMeter start={start} />
            {showcase && (
              <ol className="relative space-y-1 before:absolute before:bottom-3 before:left-[1.15rem] before:top-3 before:w-px before:bg-border">
                {showcase.tiers.map((tier, i) => {
                  const yours = tier.rank <= start;
                  return (
                    <li
                      key={`${tier.rank}-${tier.title}`}
                      className="cg-tier relative flex gap-4 py-2"
                      style={{ animationDelay: `${250 + i * 80}ms` }}
                    >
                      <span
                        className={cn(
                          "relative z-10 grid size-9 shrink-0 place-items-center border font-mono text-sm font-bold tabular-nums",
                          yours
                            ? "border-primary bg-primary text-primary-foreground shadow-[0_0_16px_-4px_var(--color-primary)]"
                            : "border-border bg-background text-muted-foreground",
                        )}
                      >
                        {tier.rank}
                      </span>
                      <div className="min-w-0 pt-1">
                        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span
                            className={cn(
                              "text-base font-bold tracking-tight",
                              yours ? "text-foreground" : "text-foreground/75",
                            )}
                          >
                            {tier.title}
                          </span>
                          <span
                            className={cn(
                              "font-mono text-[10px] uppercase tracking-[0.18em]",
                              yours ? "text-primary" : "text-muted-foreground",
                            )}
                          >
                            {yours ? "Yours on day one" : `At Rank ${tier.rank}`}
                          </span>
                        </p>
                        <p
                          className={cn(
                            "mt-0.5 text-sm leading-relaxed",
                            yours ? "text-foreground/85" : "text-muted-foreground",
                          )}
                        >
                          {tier.body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {opening && !opening.unbuilt && opening.facts.length > 0 && (
            <section className="space-y-3 border-t border-border pt-6">
              <Eyebrow>Your first night, in numbers</Eyebrow>
              <ul className="grid gap-3 sm:grid-cols-2">
                {opening.facts.map((fact) => (
                  <li key={fact.label} className="border border-border bg-card p-3">
                    <p className="text-sm font-semibold text-foreground">{fact.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {fact.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setRulesOpen((v) => !v)}
              aria-expanded={rulesOpen}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground hover:underline"
            >
              {rulesOpen ? "Hide the printed rule" : "Read the printed rule"}
            </button>
            {rulesOpen && (
              <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                {role.roleAbility.mechanicalText}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ROLES = rolesData.roles as unknown as Record<string, ModalRole>;

/**
 * Anything that names a Role Ability can open it: wraps `children` in a button
 * that opens the modal for `roleId`. Renders the children unchanged for a Role
 * the data does not know.
 */
export function RoleAbilityTrigger({
  roleId,
  className,
  children,
}: {
  roleId: string | null | undefined;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const role = roleId ? ROLES[roleId] : undefined;
  if (!role) return <span className={className}>{children}</span>;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "cursor-pointer text-left underline decoration-dotted underline-offset-4 transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
          className,
        )}
      >
        {children}
      </button>
      <RoleAbilityModal role={role} open={open} onOpenChange={setOpen} />
    </>
  );
}
