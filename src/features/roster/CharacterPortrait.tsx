import { ArtSlot } from "@/features/chargen/ArtSlot";
import { portraitArt, portraitById } from "@/features/chargen/art";
import { PortraitLightbox } from "@/features/chargen/PortraitLightbox";
import { usePortraitUrl } from "@/features/chargen/usePortraitUrl";
import { cn } from "@/lib/utils";

/**
 * Cinematic 3:4 portrait plate for a roster dossier. Presentation only —
 * it reads the same portrait sources the character sheet uses.
 */
export function CharacterPortrait({
  name,
  handle,
  portraitId,
  portraitPath,
  emphasised,
}: {
  name: string;
  handle?: string | null;
  portraitId?: string | null;
  portraitPath?: string | null;
  emphasised?: boolean;
}) {
  const preset = portraitId ? portraitById(portraitId) : undefined;
  const generated = usePortraitUrl(portraitPath ?? null);
  const src = generated ?? (preset ? portraitArt(preset).src : null);

  const frame = (
    <div className="absolute inset-0 overflow-hidden">
      {generated ? (
        <img
          src={generated}
          alt={`${name} portrait`}
          loading="lazy"
          className={cn(
            "h-full w-full object-cover object-top transition-transform duration-[260ms] ease-out motion-reduce:transition-none",
            emphasised ? "scale-[1.015]" : "scale-100",
          )}
        />
      ) : preset ? (
        <ArtSlot art={portraitArt(preset)} label={name} />
      ) : (
        <div className="flex h-full items-center justify-center bg-[radial-gradient(120%_90%_at_50%_0%,color-mix(in_oklab,var(--color-neon-purple)_18%,transparent),transparent_70%)] font-mono text-[10px] uppercase tracking-[0.24em] text-text-dim">
          No portrait
        </div>
      )}
    </div>
  );

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden">
      {src ? (
        <PortraitLightbox
          src={src}
          alt={`${name} portrait`}
          subtitle={handle ? `"${handle}"` : undefined}
          className="absolute inset-0 block h-full w-full"
        >
          {frame}
        </PortraitLightbox>
      ) : (
        frame
      )}

      {/* Environmental grade: the city light falls across the plate, and the
          bottom dissolves into the card surface so the portrait breaks frame. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_38%,color-mix(in_oklab,var(--color-ground)_72%,transparent)_78%,var(--color-ground)_100%)]"
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 mix-blend-screen transition-opacity duration-200 motion-reduce:transition-none",
          emphasised ? "opacity-100" : "opacity-60",
        )}
        style={{
          background:
            "radial-gradient(80% 55% at 8% 4%, color-mix(in oklab, var(--color-neon-cyan) 16%, transparent), transparent 60%), radial-gradient(70% 60% at 100% 90%, color-mix(in oklab, var(--color-neon-pink) 14%, transparent), transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,0.55)]"
      />
    </div>
  );
}
