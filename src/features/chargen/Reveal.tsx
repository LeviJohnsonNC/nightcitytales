import { useMemo } from "react";
import { districtOfPlace, getPlace, type CastMember, type CastRole } from "@/engine";
import { findNpc, npcArtwork } from "@/features/cast/npcDirectory";
import rolesData from "@/data/rules/roles.json";
import { fixerVoice } from "./interview";
import { castForState } from "./revealModel";
import type { ChargenState } from "./store";
import { usePortraitUrl } from "./usePortraitUrl";
import "./interview.css";

const ROLE_NAMES = rolesData.roles as unknown as Record<string, { name: string }>;

/** The three people waiting in the city, and how each of them thinks of you. */
const WAITING: { role: CastRole; label: string }[] = [
  { role: "enemy", label: "Wants you dead" },
  { role: "friend", label: "Has your back" },
  { role: "old_flame", label: "Still thinks about you" },
];

/**
 * The file, read back.
 *
 * The last screen used to be a save button over a character sheet. This is the
 * moment the character becomes somebody: their face, their name typed onto the
 * file, what they do, where they sleep, the three people already waiting for
 * them in the city, and the fixer's verdict. The sheet is still there,
 * underneath, for anybody who wants every number.
 */
export function Reveal({
  state,
  homePlaceKey,
}: {
  state: ChargenState;
  homePlaceKey: string | null;
}) {
  const portrait = usePortraitUrl(state.portraitPath);
  const cast = useMemo(() => castForState(state), [state]);
  const fixer = state.castPlan?.picks.fixer ?? null;
  const verdict = fixerVoice(fixer)?.verdict ?? null;
  const fixerArt = fixer ? findNpc(fixer) : null;
  const role = state.roleId ? ROLE_NAMES[state.roleId]?.name : null;
  const handle = state.handle.trim();
  const place = homePlaceKey ? getPlace(homePlaceKey) : undefined;
  const district = homePlaceKey ? districtOfPlace(homePlaceKey) : undefined;

  return (
    <section className="relative overflow-hidden border border-hairline bg-surface">
      <div aria-hidden className="cg-rain" />
      <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="cg-arrive aspect-[3/4] w-full overflow-hidden border border-hairline bg-background/60">
          {portrait ? (
            <img src={portrait} alt={handle || state.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-text-dim">
              No photo on file
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
              Night City · File opened
            </p>
            <h2
              className="cg-glitch text-5xl font-bold uppercase leading-none tracking-tight sm:text-6xl"
              style={{ animationDelay: "300ms" }}
            >
              {handle || state.name || "Unknown"}
            </h2>
            <p className="text-lg text-text-muted">
              {[handle ? state.name : null, role, state.pronouns || null]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {place && (
              <p className="text-sm text-text-muted">
                Sleeps at <span className="text-text">{place.name}</span>
                {district ? `, ${district.name}` : ""}
              </p>
            )}
          </div>

          {state.selfDescription.trim() && (
            <p className="max-w-2xl text-base italic leading-relaxed">
              {state.selfDescription.trim()}
            </p>
          )}

          {cast.length > 0 && (
            <div className="space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-text-dim">
                Already waiting for you
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {WAITING.map(({ role: slot, label }, i) => {
                  const member = cast.find((m) => m.role === slot);
                  if (!member) return null;
                  return <Face key={slot} member={member} label={label} delay={700 + i * 220} />;
                })}
              </div>
            </div>
          )}

          {fixer && verdict && (
            <figure
              className="cg-say flex items-start gap-4 border-l-2 border-ember bg-ember/5 p-4"
              style={{ animationDelay: "1500ms" }}
            >
              {fixerArt && (
                <img
                  src={npcArtwork(fixerArt).srcSet.split(" ")[0]}
                  alt={fixer}
                  className="h-14 w-14 shrink-0 object-cover object-top"
                />
              )}
              <blockquote className="space-y-1">
                <p className="text-lg leading-snug">“{verdict}”</p>
                <footer className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
                  {fixer}, your fixer
                </footer>
              </blockquote>
            </figure>
          )}
        </div>
      </div>
    </section>
  );
}

function Face({ member, label, delay }: { member: CastMember; label: string; delay: number }) {
  const npc = findNpc(member.name);
  const art = npc ? npcArtwork(npc) : null;
  return (
    <div
      className="cg-face overflow-hidden border border-hairline bg-card"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative aspect-square w-full overflow-hidden">
        {art && (
          <img
            src={art.srcSet.split(" ")[0]}
            alt={member.name}
            className="h-full w-full object-cover object-top"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        <p className="absolute left-2 top-2 bg-background/80 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-accent">
          {label}
        </p>
        <p className="absolute inset-x-0 bottom-0 p-2 text-sm font-bold leading-tight">
          {member.name}
        </p>
      </div>
      <p className="p-2 text-xs leading-snug text-text-muted">{member.tie ?? member.standing}</p>
    </div>
  );
}
