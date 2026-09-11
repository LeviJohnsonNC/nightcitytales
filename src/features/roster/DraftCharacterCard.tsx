import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import rolesData from "@/data/rules/roles.json";
import { stepDefinition, type ChargenStep } from "@/features/chargen/steps";
import type { ChargenState } from "@/features/chargen/store";
import { getLatestDraft } from "@/lib/backend";

const ROLE_NAMES = rolesData.roles as unknown as Record<string, { name: string }>;

/** The unfinished dossier strip: narrow, smoked, and deliberately unresolved. */
export function DraftCharacterCard() {
  const { data } = useQuery({ queryKey: ["chargen-draft"], queryFn: getLatestDraft });
  if (!data) return null;

  const state = (data.state ?? {}) as Partial<ChargenState>;
  const step = (state.step ?? "method") as ChargenStep;
  const def = stepDefinition(step);
  const roleName = state.roleId ? (ROLE_NAMES[state.roleId]?.name ?? state.roleId) : null;

  return (
    <section
      className="relative flex animate-[fade-in_.5s_both] items-center gap-4 overflow-hidden border border-hairline/70 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--color-surface)_70%,transparent),color-mix(in_oklab,var(--color-ground)_86%,transparent))] px-4 py-3 backdrop-blur-md motion-reduce:animate-none"
      style={{ animationDelay: "60ms" }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-px bg-[linear-gradient(180deg,transparent,var(--color-neon-purple),transparent)]"
      />
      <div className="relative flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden bg-surface-raised/40">
        <UserRound className="h-7 w-7 text-text-dim/50" aria-hidden />
        <span
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,color-mix(in_oklab,var(--color-ground)_92%,transparent))]"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-mono text-[9px] uppercase tracking-[0.34em] text-accent">Unfinished</p>
        <p className="truncate font-display text-base font-bold text-text">
          {state.name?.trim() || "Unnamed Character"}
          {roleName ? <span className="text-text-muted"> · {roleName}</span> : null}
        </p>
        <p className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">
          Step {String(def.index).padStart(2, "0")} · {def.title}
        </p>
      </div>

      <Link
        to="/create"
        className="shrink-0 border border-accent/60 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-accent transition-colors hover:bg-accent/15 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Resume Creation
      </Link>
    </section>
  );
}
