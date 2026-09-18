/**
 * Choosing who you are.
 *
 * This screen used to sell every Role with 2,345 characters of rank table
 * behind a button marked "Show how it works". Nobody has ever chosen a class
 * because of a rank table, and the printed prose beside it was an encyclopedia
 * entry — "Rockerboys ARE street poets" — aimed at a reader rather than at
 * somebody deciding who to be.
 *
 * Three things replace it, in the order a person actually asks them:
 *
 *  - WHAT WOULD I DO? One street corner, shown identically to every Role, and
 *    underneath it what THIS one sees in it. Switch Roles and the alley does
 *    not move; the answer does. That comparison is the whole decision, and it
 *    is the one thing a list of ten descriptions can never make.
 *  - WHAT DO I GET? Concrete things, on the first night, COMPUTED — the bench's
 *    real prices, the Fixer's real Reach, the Nomad's real motorpool, from the
 *    same engine functions play runs on (engine/roleOpening.ts). A promise the
 *    creator makes has to be a promise the game keeps.
 *  - AND THE RULES? Still here, one click away, at the bottom. No longer the
 *    door.
 *
 * The book's own tagline and lore are not thrown away — they are moved below
 * the fold, for the player who is already sold and wants to sink in.
 */
import { useRef, useState } from "react";
import rolesData from "@/data/rules/roles.json";
import { Button } from "@/components/ui/button";
import { SHARED_SCENE, roleAnswer, roleOpening, type RoleOpening } from "@/engine";
import { cn } from "@/lib/utils";
import { ArtSlot } from "./ArtSlot";
import { roleArt, sceneArt } from "./art";
import { ROLE_HOOK, ROLE_PLAYS_LIKE } from "./copy";
import { emphasizeTerms, loreParagraphs } from "./loreFormat";
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
  return raw.replace(/^plays like:\s*/i, "");
}

/** Presentation-only: banner crops that would otherwise clip the character's head. */
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

function RoleTile({
  role,
  committed,
  previewed,
  onPreview,
}: {
  role: Role;
  committed: boolean;
  previewed: boolean;
  onPreview: () => void;
}) {
  const hook = ROLE_HOOK[role.id];
  const unbuilt = roleOpening(role.id, role.roleAbility.startingRank)?.unbuilt === true;
  return (
    <button
      type="button"
      onClick={onPreview}
      aria-pressed={previewed}
      className={cn(
        "group relative block aspect-[16/10] w-full overflow-hidden border bg-card text-left transition-colors",
        committed
          ? "border-primary"
          : previewed
            ? "border-accent"
            : "border-border hover:border-accent/60",
      )}
    >
      <ArtSlot art={roleArt(role.id, role.name)} label={role.name} className="border-0" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      {committed && (
        <span className="absolute right-2 top-2 z-10 bg-primary px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-primary-foreground">
          Selected
        </span>
      )}
      {!committed && unbuilt && (
        <span className="absolute right-2 top-2 z-10 bg-muted px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
          Coming later
        </span>
      )}
      <div className="absolute bottom-2 left-3 right-3">
        <h3 className="truncate text-base font-bold tracking-tight">{role.name}</h3>
        {hook && <p className="truncate text-[11px] leading-tight text-accent">{hook}</p>}
      </div>
    </button>
  );
}

/**
 * The same alley, answered by this Role.
 *
 * Renders nothing when the data has no answer, so a Role added later reads as
 * one section short rather than as an empty heading. The scene image never
 * changes between Roles — that repetition is the point, so the comparison
 * lands on the two labeled parts that do change.
 */
function TheAlley({ roleId, roleName }: { roleId: string; roleName: string }) {
  const answer = roleAnswer(roleId);
  if (!answer) return null;
  return (
    <div className="space-y-2 border border-border bg-background/60 p-3">
      <Eyebrow>Same alley. Different read.</Eyebrow>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="h-32 w-full flex-shrink-0 overflow-hidden sm:h-auto sm:w-28">
          <ArtSlot art={sceneArt("alley", "The alley")} label="The alley" className="border-0" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-sm italic leading-relaxed text-muted-foreground">{SHARED_SCENE}</p>
          <div className="space-y-1">
            <Eyebrow>How a {roleName} reads it</Eyebrow>
            <p className="border-l-2 border-accent pl-3 text-sm leading-relaxed">
              {answer.player}
            </p>
          </div>
          <div className="space-y-1">
            <Eyebrow>What they'd do here</Eyebrow>
            <ol className="space-y-1">
              {answer.answers.map((line, i) => (
                <li key={line} className="flex gap-2 text-sm leading-relaxed">
                  <span aria-hidden className="font-mono text-accent">
                    {i + 1}.
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

/** What the Role hands you on day one. Every figure computed, none transcribed. */
function TonightYouHave({ opening }: { opening: RoleOpening }) {
  return (
    <div className="space-y-3">
      <Eyebrow>{opening.unbuilt ? "Before you pick this" : "On your first night"}</Eyebrow>
      <ul className="space-y-3">
        {opening.facts.map((fact) => (
          <li key={fact.label}>
            <p
              className={cn(
                "text-sm font-semibold",
                opening.unbuilt ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {fact.label}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">{fact.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoleSpotlight({
  role,
  committed,
  onChoose,
}: {
  role: Role;
  committed: boolean;
  onChoose: () => void;
}) {
  const [loreOpen, setLoreOpen] = useState(false);
  const [abilityOpen, setAbilityOpen] = useState(false);
  const plays = playsBody(role.id);
  const paragraphs = loreParagraphs(role.flavorText);
  const emphasisTerms = [`${role.name}s`, role.name, role.roleAbility.name];
  const opening = roleOpening(role.id, role.roleAbility.startingRank);

  return (
    <div className="overflow-hidden border border-border bg-card">
      <div className="relative h-48 border-b border-border sm:h-64">
        <ArtSlot
          art={roleArt(role.id, role.name)}
          label={role.name}
          className="border-0"
          focalOverride={SPOTLIGHT_FOCAL[role.id]}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
        <h2 className="absolute bottom-3 left-4 text-2xl font-bold tracking-tight sm:text-3xl">
          {role.name}
        </h2>
      </div>

      {/* The promise, in the player's own second person, before anything else. */}
      {opening && (
        <p className="border-b border-border px-4 py-3 text-base leading-snug sm:text-lg">
          {opening.headline}
        </p>
      )}

      <div className="grid gap-4 p-4 lg:grid-cols-2 lg:gap-6">
        <div className="min-w-0 space-y-3">
          <TheAlley roleId={role.id} roleName={role.name} />
          {plays && (
            <p className="border-l-2 border-primary/70 bg-primary/5 px-3 py-2 text-sm leading-relaxed">
              <span className="font-semibold text-primary">Plays like:</span> {plays}
            </p>
          )}
        </div>

        <div className="min-w-0 space-y-4 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          {opening && <TonightYouHave opening={opening} />}

          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <Eyebrow>Role Ability</Eyebrow>
              <span className="font-mono text-base font-bold tracking-tight">
                {role.roleAbility.name}
                <span className="ml-2 text-primary">Rank {role.roleAbility.startingRank}</span>
              </span>
            </div>

            <Button
              className="w-full"
              variant={committed ? "outline" : "default"}
              disabled={committed}
              onClick={onChoose}
            >
              {committed ? `Selected: ${role.name}` : `Choose the ${role.name}`}
            </Button>
          </div>
        </div>
      </div>

      {/* Below the fold: the book's own words, for somebody already sold. */}
      <div className="space-y-3 border-t border-border bg-background/40 p-4">
        <p className="text-sm text-accent">{role.tagline}</p>
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
            onClick={() => setAbilityOpen((v) => !v)}
            aria-expanded={abilityOpen}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:underline"
          >
            {abilityOpen ? "Hide the printed rule" : "Read the printed rule"}
          </button>
        </div>

        {abilityOpen && (
          <p className="max-h-64 overflow-y-auto whitespace-pre-line border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground">
            {role.roleAbility.mechanicalText}
          </p>
        )}
      </div>
    </div>
  );
}

export function RolePanel({
  state,
  onRequestRole,
}: {
  state: ChargenState;
  onRequestRole: (roleId: string) => void;
}) {
  const [previewId, setPreviewId] = useState<string>(state.roleId ?? ROLES[0]!.id);
  const preview = ROLES.find((r) => r.id === previewId) ?? ROLES[0]!;
  const detailsRef = useRef<HTMLDivElement>(null);

  function previewRole(roleId: string) {
    setPreviewId(roleId);
    requestAnimationFrame(() => {
      detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      detailsRef.current?.focus({ preventScroll: true });
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {ROLES.map((role) => (
          <RoleTile
            key={role.id}
            role={role}
            committed={state.roleId === role.id}
            previewed={previewId === role.id}
            onPreview={() => previewRole(role.id)}
          />
        ))}
      </div>

      <div ref={detailsRef} tabIndex={-1} className="scroll-mt-20 outline-none">
        <RoleSpotlight
          key={preview.id}
          role={preview}
          committed={state.roleId === preview.id}
          onChoose={() => onRequestRole(preview.id)}
        />
      </div>
    </div>
  );
}
