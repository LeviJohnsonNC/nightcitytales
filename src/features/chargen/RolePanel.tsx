/**
 * Choosing who you are.
 *
 * This screen used to sell every Role with 2,345 characters of rank table
 * behind a button marked "Show how it works". Nobody has ever chosen a class
 * because of a rank table, and the printed prose beside it was an encyclopedia
 * entry — "Rockerboys ARE street poets" — aimed at a reader rather than at
 * somebody deciding who to be.
 *
 * The Roles come as a cover-flow carousel, in an order shuffled once per
 * character (so no Role is always first), and the one in the middle is the one
 * the page is about. Below it, in the order a person actually asks:
 *
 *  - WHAT WOULD I DO? One street corner, shown identically to every Role, and
 *    underneath it what THIS one sees in it. Switch Roles and the alley does
 *    not move; the answer does.
 *  - WHAT IS IT LIKE? The first night, told as a scene (`ROLE_FIRST_NIGHT`),
 *    with no game terms in it. Every beat is something the engine keeps.
 *  - AND THE RULES? The printed rule and the first night in numbers — computed
 *    from the functions play runs on (engine/roleOpening.ts) — one click away
 *    at the bottom. No longer the door.
 *
 * Choosing is one action: the bar pinned to the bottom of the screen takes the
 * Role in the middle and moves on, and the fixer's reaction opens the next
 * step. There is no separate "choose" followed by a hunt for Next.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import rolesData from "@/data/rules/roles.json";
import { Button } from "@/components/ui/button";
import { SHARED_SCENE, roleAnswer, roleOpening, seededRng, type RoleOpening } from "@/engine";
import { cn } from "@/lib/utils";
import { ArtSlot } from "./ArtSlot";
import { roleArt, sceneArt } from "./art";
import { ROLE_FIRST_NIGHT, ROLE_HOOK, ROLE_PLAYS_LIKE } from "./copy";
import { emphasizeTerms, loreParagraphs } from "./loreFormat";
import { RoleAbilityModal } from "./RoleAbilityModal";
import { ROLE_ABILITY_SHOWCASE } from "./roleAbilityShowcase";
import type { ChargenState } from "./store";

type Role = {
  id: string;
  name: string;
  tagline: string;
  flavorText: string;
  roleAbility: { id: string; name: string; startingRank: number; mechanicalText: string };
};

const ROLES = Object.values(rolesData.roles as unknown as Record<string, Role>);

/** Strip the leading "Plays like:" label so we can present it ourselves. */
function playsBody(roleId: string): string {
  const raw = ROLE_PLAYS_LIKE[roleId] ?? "";
  const body = raw.replace(/^plays like:\s*/i, "");
  // It read as the second half of "Plays like: …"; on its own it starts a sentence.
  return body.charAt(0).toUpperCase() + body.slice(1);
}

/** Presentation-only: crops that would otherwise clip the character's head. */
const SPOTLIGHT_FOCAL: Record<string, [number, number]> = {
  rockerboy: [0.5, 0.15],
  solo: [0.5, 0.15],
  lawman: [0.5, 0.15],
  fixer: [0.5, 0.15],
  nomad: [0.5, 0.15],
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </p>
  );
}

/** The Roles in this character's order: shuffled once, from the draft's own seed, so a reload keeps it. */
function shuffledRoles(seed: number): Role[] {
  const rng = seededRng((seed ^ 0x201e5) >>> 0);
  const order = [...ROLES];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

/** How far card `i` sits from the middle, going round the shorter way. */
function offsetFrom(i: number, index: number, n: number): number {
  let d = (i - index) % n;
  if (d > n / 2) d -= n;
  if (d < -n / 2) d += n;
  return d;
}

/**
 * Cover-flow: the Role in the middle large and lit, its neighbours angled back
 * on either side. Arrows, a swipe, the arrow keys, or a click on a side card
 * turn it; the dots under it jump.
 */
function RoleCarousel({
  roles,
  index,
  onIndex,
  committedId,
}: {
  roles: Role[];
  index: number;
  onIndex: (index: number) => void;
  committedId: string | null;
}) {
  const n = roles.length;
  const drag = useRef<{ x: number; id: number } | null>(null);
  const go = (by: number) => onIndex((index + by + n) % n);

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    drag.current = null;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Roles"
      className="space-y-4"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        else if (e.key === "ArrowLeft") go(-1);
        else return;
        e.preventDefault();
      }}
    >
      <div
        className="relative aspect-[100/50] w-full touch-pan-y select-none overflow-hidden [perspective:1600px] md:aspect-[100/38]"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, id: e.pointerId };
        }}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {roles.map((role, i) => {
          const d = offsetFrom(i, index, n);
          const away = Math.abs(d);
          const centre = d === 0;
          const hidden = away > 2;
          const hook = ROLE_HOOK[role.id];
          const unbuilt = roleOpening(role.id, role.roleAbility.startingRank)?.unbuilt === true;
          return (
            <button
              key={role.id}
              type="button"
              tabIndex={centre ? 0 : -1}
              aria-hidden={hidden}
              aria-current={centre ? "true" : undefined}
              aria-label={centre ? `${role.name}: ${hook ?? ""}` : `Show ${role.name}`}
              onClick={() => (centre ? undefined : onIndex(i))}
              className={cn(
                "absolute left-1/2 top-1/2 aspect-[16/9] w-[80%] overflow-hidden border text-left md:w-[62%]",
                "transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
                centre
                  ? committedId === role.id
                    ? "cursor-default border-primary shadow-[0_0_40px_-8px_var(--color-primary)]"
                    : "cursor-default border-accent/70 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.9)]"
                  : "cursor-pointer border-border",
              )}
              style={{
                transform: `translate(-50%, -50%) translateX(${d * 56}%) translateZ(${-away * 180}px) rotateY(${-Math.sign(d) * Math.min(away, 1) * 32}deg) scale(${centre ? 1 : 0.9})`,
                zIndex: 10 - away,
                opacity: hidden ? 0 : away === 2 ? 0.35 : 1,
                filter: centre ? "none" : `brightness(${away === 1 ? 0.5 : 0.35}) saturate(0.8)`,
                pointerEvents: hidden ? "none" : undefined,
              }}
            >
              <ArtSlot
                art={roleArt(role.id, role.name)}
                label={role.name}
                className="border-0"
                focalOverride={SPOTLIGHT_FOCAL[role.id]}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/25 to-transparent" />
              {committedId === role.id && (
                <span className="absolute right-3 top-3 bg-primary px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-primary-foreground">
                  Your Role
                </span>
              )}
              {committedId !== role.id && unbuilt && (
                <span className="absolute right-3 top-3 bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Coming later
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 space-y-1 p-4 sm:p-6">
                <h3
                  className={cn(
                    "font-bold tracking-tight transition-[font-size] duration-500",
                    centre ? "text-3xl sm:text-5xl" : "text-xl",
                  )}
                >
                  {role.name}
                </h3>
                {centre && hook && <p className="text-sm text-accent sm:text-base">{hook}</p>}
              </div>
            </button>
          );
        })}

        <button
          type="button"
          aria-label="Previous Role"
          onClick={() => go(-1)}
          className="absolute left-2 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/70 text-foreground backdrop-blur transition-colors hover:border-accent hover:text-accent sm:left-4"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Next Role"
          onClick={() => go(1)}
          className="absolute right-2 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/70 text-foreground backdrop-blur transition-colors hover:border-accent hover:text-accent sm:right-4"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>

      <div className="flex items-center justify-center gap-4">
        <span className="font-mono text-[11px] tracking-[0.25em] text-muted-foreground">
          {String(index + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
        </span>
        <div className="flex gap-1.5" role="group" aria-label="Jump to a Role">
          {roles.map((role, i) => (
            <button
              key={role.id}
              type="button"
              aria-label={role.name}
              aria-current={i === index ? "true" : undefined}
              onClick={() => onIndex(i)}
              className={cn(
                "h-1 rounded-full transition-all duration-500",
                i === index
                  ? "w-8 bg-accent"
                  : committedId === role.id
                    ? "w-3 bg-primary"
                    : "w-3 bg-border hover:bg-muted-foreground",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The same alley, answered by this Role.
 *
 * Renders nothing when the data has no answer, so a Role added later reads as
 * one section short rather than as an empty heading. The scene image never
 * changes between Roles — that repetition is the point, so the comparison
 * lands on the two labeled parts that do change.
 *
 * The picture runs the box's full width as a banner, scene caption burned
 * into it under the same gradient-scrim treatment the role banner above uses
 * for its own heading. The Role's two answers sit below it in their own
 * tinted panels — accent for the read, primary for the moves — so the two
 * kinds of answer are told apart at a glance rather than by reading the
 * label first.
 */
function TheAlley({ roleId, roleName }: { roleId: string; roleName: string }) {
  const answer = roleAnswer(roleId);
  if (!answer) return null;
  return (
    <div className="space-y-3 border border-border bg-background/60 p-3">
      <Eyebrow>Same alley. Different read.</Eyebrow>
      <div className="relative h-56 w-full overflow-hidden sm:h-64">
        <ArtSlot art={sceneArt("alley", "The alley")} label="The alley" className="border-0" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <p className="absolute inset-x-0 bottom-0 p-4 text-sm italic leading-relaxed text-foreground [text-shadow:0_1px_4px_rgb(0_0_0_/_0.85)] sm:text-base">
          {SHARED_SCENE}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 border-l-2 border-accent bg-accent/5 p-3">
          <Eyebrow>How a {roleName} reads it</Eyebrow>
          <p className="text-sm leading-relaxed">{answer.player}</p>
        </div>
        <div className="space-y-2 border-l-2 border-primary bg-primary/5 p-3">
          <Eyebrow>What they'd do here</Eyebrow>
          <ol className="space-y-2">
            {answer.answers.map((line, i) => (
              <li key={line} className="flex gap-2 text-sm leading-relaxed">
                <span aria-hidden className="font-mono font-bold text-primary">
                  {i + 1}.
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/** The first night, as a scene: what being this Role feels like. */
function FirstNight({ roleId, unbuilt }: { roleId: string; unbuilt: boolean }) {
  const beats = ROLE_FIRST_NIGHT[roleId] ?? [];
  if (beats.length === 0) return null;
  return (
    <div className="space-y-4">
      <Eyebrow>{unbuilt ? "Before you pick this" : "On your first night"}</Eyebrow>
      <ul className="space-y-4">
        {beats.map((beat) => (
          <li key={beat.title} className="space-y-1">
            <p className="text-base font-semibold leading-snug text-foreground">{beat.title}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{beat.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The first night in numbers — every figure computed by the engine — beside the printed rule. */
function InNumbers({ opening }: { opening: RoleOpening }) {
  return (
    <ul className="space-y-2">
      {opening.facts.map((fact) => (
        <li key={fact.label} className="text-xs leading-relaxed">
          <span className="font-semibold text-foreground">{fact.label}.</span>{" "}
          <span className="text-muted-foreground">{fact.detail}</span>
        </li>
      ))}
    </ul>
  );
}

function RoleSpotlight({ role }: { role: Role }) {
  const [loreOpen, setLoreOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [abilityOpen, setAbilityOpen] = useState(false);
  const plays = playsBody(role.id);
  const paragraphs = loreParagraphs(role.flavorText);
  const emphasisTerms = [`${role.name}s`, role.name, role.roleAbility.name];
  const opening = roleOpening(role.id, role.roleAbility.startingRank);

  return (
    <div className="overflow-hidden border border-border bg-card">
      {/* The promise, in the player's own second person, before anything else. */}
      {opening && (
        <p className="border-b border-border px-4 py-4 text-lg leading-snug sm:px-6 sm:text-xl">
          {opening.headline}
        </p>
      )}

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-2 lg:gap-6">
        <div className="min-w-0">
          <TheAlley roleId={role.id} roleName={role.name} />
        </div>

        <div className="min-w-0 space-y-5 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <FirstNight roleId={role.id} unbuilt={opening?.unbuilt === true} />
          <button
            type="button"
            onClick={() => setAbilityOpen(true)}
            className="group relative block w-full overflow-hidden border border-primary/40 bg-primary/5 p-4 text-left transition-[border-color,background-color,box-shadow] duration-300 hover:border-primary hover:bg-primary/10 hover:shadow-[0_0_28px_-10px_var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="flex items-baseline justify-between gap-3">
              <Eyebrow>Role Ability</Eyebrow>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary transition-transform duration-300 group-hover:translate-x-0.5">
                See what it does →
              </span>
            </span>
            <span className="mt-1 block font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              {role.roleAbility.name}
            </span>
            {ROLE_ABILITY_SHOWCASE[role.id] && (
              <span className="mt-1 block text-sm leading-snug text-muted-foreground">
                {ROLE_ABILITY_SHOWCASE[role.id]!.pitch}
              </span>
            )}
          </button>
          <RoleAbilityModal role={role} open={abilityOpen} onOpenChange={setAbilityOpen} />
        </div>
      </div>

      {/* Below the fold: the book's own words, for somebody already sold. */}
      <div className="space-y-3 border-t border-border bg-background/40 p-4 sm:p-6">
        <p className="text-sm text-accent">{role.tagline}</p>
        {plays && <p className="text-sm leading-relaxed text-foreground">{plays}</p>}
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          {(loreOpen ? paragraphs : paragraphs.slice(0, 1)).map((para, i) => (
            <p key={i} className={cn(!loreOpen && "line-clamp-3")}>
              {emphasizeTerms(para, emphasisTerms).map((seg, j) =>
                seg.emphasis ? (
                  <strong key={j} className="font-semibold text-foreground">
                    {seg.text}
                  </strong>
                ) : (
                  <span key={j}>{seg.text}</span>
                ),
              )}
            </p>
          ))}
        </div>

        <div className="flex flex-wrap gap-4">
          {paragraphs.length > 1 && (
            <button
              type="button"
              onClick={() => setLoreOpen((v) => !v)}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-neon-cyan hover:underline"
            >
              {loreOpen ? "Show less" : `More about ${role.name}s`}
            </button>
          )}
          <button
            type="button"
            onClick={() => setRulesOpen((v) => !v)}
            aria-expanded={rulesOpen}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:underline"
          >
            {rulesOpen ? "Hide the printed rule" : "Read the printed rule"}
          </button>
        </div>

        {rulesOpen && (
          <div className="space-y-3 border border-border bg-background p-3">
            {opening && !opening.unbuilt && (
              <div className="space-y-2">
                <Eyebrow>Your first night, in numbers</Eyebrow>
                <InNumbers opening={opening} />
              </div>
            )}
            <div className="space-y-2">
              <Eyebrow>
                {role.roleAbility.name} · starts at Rank {role.roleAbility.startingRank}
              </Eyebrow>
              <p className="max-h-64 overflow-y-auto whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                {role.roleAbility.mechanicalText}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The one action on this page, pinned to the bottom of the screen: take the
 * Role in the middle of the carousel and move on. It follows the carousel, so
 * it is never below the fold and never about a Role you scrolled past.
 */
function ChooseBar({
  role,
  committed,
  onChoose,
}: {
  role: Role;
  committed: boolean;
  onChoose: () => void;
}) {
  const opening = roleOpening(role.id, role.roleAbility.startingRank);
  const unbuilt = opening?.unbuilt === true;
  return (
    <div className="sticky bottom-4 z-20 flex items-center gap-4 border border-border bg-background/85 px-4 py-3 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.9)] backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{role.name}</p>
        {opening && (
          <p className="hidden text-pretty text-xs text-muted-foreground sm:block">
            {opening.headline}
          </p>
        )}
      </div>
      <Button onClick={onChoose} disabled={unbuilt} className="shrink-0">
        {unbuilt
          ? "Not playable yet"
          : committed
            ? `Continue as ${role.name} →`
            : `Be the ${role.name} →`}
      </Button>
    </div>
  );
}

export function RolePanel({
  state,
  onRequestRole,
}: {
  state: ChargenState;
  onRequestRole: (roleId: string, advance?: boolean) => void;
}) {
  const seed = state.castPlan?.seed ?? 0;
  const roles = useMemo(() => shuffledRoles(seed), [seed]);
  const startAt = Math.max(
    0,
    roles.findIndex((r) => r.id === state.roleId),
  );
  const [index, setIndex] = useState(startAt);
  // The order changes if the draft's seed arrives after the first render.
  useEffect(() => setIndex(startAt), [roles]); // eslint-disable-line react-hooks/exhaustive-deps
  const role = roles[index] ?? roles[0]!;

  return (
    <div className="space-y-6">
      <RoleCarousel roles={roles} index={index} onIndex={setIndex} committedId={state.roleId} />
      <RoleSpotlight key={role.id} role={role} />
      <ChooseBar
        role={role}
        committed={state.roleId === role.id}
        onChoose={() => onRequestRole(role.id, true)}
      />
    </div>
  );
}
