import { useRef, useState } from "react";
import rolesData from "@/data/rules/roles.json";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArtSlot } from "./ArtSlot";
import { roleArt } from "./art";
import { ROLE_PLAYS_LIKE } from "./copy";
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

function RoleTile({
  role,
  committed,
  previewed,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onPreview,
}: {
  role: Role;
  committed: boolean;
  previewed: boolean;
  onPreview: () => void;
}) {
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
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      {committed && (
        <span className="absolute right-2 top-2 z-10 bg-primary px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-primary-foreground">
          Selected
        </span>
      )}
      <h3 className="absolute bottom-2 left-3 right-3 truncate text-base font-bold tracking-tight">
        {role.name}
      </h3>
    </button>
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

      <div className="grid gap-4 p-4 lg:grid-cols-2 lg:gap-6">
        <div className="min-w-0 space-y-3">
          <p className="text-sm text-accent">{role.tagline}</p>

          {plays && (
            <p className="border-l-2 border-primary/70 bg-primary/5 px-3 py-2 text-sm leading-relaxed">
              <span className="font-semibold text-primary">Plays like:</span> {plays}
            </p>
          )}

          <div>
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              {(loreOpen ? paragraphs : paragraphs.slice(0, 1)).map((para, i) => (
                <p key={i} className={cn(!loreOpen && "line-clamp-4")}>
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
            {paragraphs.length > 1 && (
              <button
                type="button"
                onClick={() => setLoreOpen((v) => !v)}
                className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-neon-cyan hover:underline"
              >
                {loreOpen ? "Show less" : "Read more"}
              </button>
            )}
          </div>

        </div>

        <div className="min-w-0 space-y-3 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Role Ability
            </span>
            <span className="font-mono text-base font-bold tracking-tight">
              {role.roleAbility.name}
              <span className="ml-2 text-primary">Rank {role.roleAbility.startingRank}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setAbilityOpen((v) => !v)}
            aria-expanded={abilityOpen}
            className="flex w-full items-center justify-between border border-neon-cyan/35 bg-neon-cyan/5 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-neon-cyan transition-colors hover:bg-neon-cyan/10"
          >
            <span>{abilityOpen ? "Hide how it works" : "Show how it works"}</span>
            <span aria-hidden className={cn("transition-transform", abilityOpen && "rotate-90")}>
              ›
            </span>
          </button>

          {abilityOpen && (
            <p className="max-h-64 overflow-y-auto whitespace-pre-line border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground">
              {role.roleAbility.mechanicalText}
            </p>
          )}

          <Button
            className="w-full"
            variant={committed ? "outline" : "default"}
            disabled={committed}
            onClick={onChoose}
          >
            {committed
              ? `Selected: ${role.roleAbility.name} Rank ${role.roleAbility.startingRank}`
              : `Choose the ${role.name}`}
          </Button>
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            You start with {role.roleAbility.name} at Rank {role.roleAbility.startingRank}
          </p>
        </div>
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
