/**
 * Where the character lives, chosen as an address rather than as a phrase.
 *
 * The printed rule (Core p.109) offers two words: Overcrowded Suburbs, or
 * Combat Zone. `startingHome.ts` turns those into the districts the atlas
 * actually has and the buildings in them actually made of freight, and this is
 * the screen for walking down that. Three stages, narrowing: category, then
 * district, then the building itself.
 *
 * The Exec skips the first stage. Their Role Ability gives them a Corporate
 * Conapt rather than a rented container, so there is no printed category to
 * pick — they choose which corporation's building they are put up in, from the
 * ten the atlas says exist for exactly that.
 *
 * NOTHING HERE DECIDES ANYTHING. Every option comes from the engine, the
 * consequence lines are read off the atlas, and the Lifepath suggestion is a
 * highlight and a sentence. No card is ever hidden or disabled because of what
 * the character's childhood was.
 */
import { useMemo } from "react";
import {
  districtsInCategory,
  execHomes,
  homePreview,
  homesIn,
  startingLifestylePlan,
  suggestedHomeIn,
  suggestedHome,
  type District,
  type HomePreview,
  type PlaceProfile,
} from "@/engine";
import { placeDossier, placeImage } from "@/features/atlas/placeDossiers";
import { cn } from "@/lib/utils";
import { readGeneralLifepath, displayValue } from "./lifepathState";
import { useChargenStore, type ChargenState } from "./store";

// ---------------------------------------------------------------------------
// Small shared pieces, in the wizard's existing voice.
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-text-dim">{children}</p>
  );
}

function Stage({ n, of, label }: { n: number; of: number; label: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-[10px] tabular-nums tracking-[0.2em] text-accent">
        {n}/{of}
      </span>
      <SectionTitle>{label}</SectionTitle>
    </div>
  );
}

/**
 * The picture for a district or a building.
 *
 * Falls back to the hatched placeholder the rest of the wizard uses rather than
 * to a grey box or a broken image, so an atlas entry whose art has not been
 * made yet still renders as something deliberate.
 */
function PlaceArt({ atlasKey, label }: { atlasKey: string; label: string }) {
  const entry = placeDossier(atlasKey);
  const src = entry ? placeImage(entry) : undefined;
  if (!src) {
    return (
      <div
        role="img"
        aria-label={`${label} — artwork pending`}
        className="flex h-full w-full items-end bg-[repeating-linear-gradient(135deg,transparent_0_10px,color-mix(in_oklab,var(--color-accent)_10%,transparent)_10px_11px)] p-3"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent/80">
          Art pending
        </span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={label}
      loading="lazy"
      className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
    />
  );
}

/**
 * One card in any of the three grids.
 *
 * Deliberately the same shape as the Role cards two steps earlier — art, a
 * scrim, the name along the bottom — so the housing step reads as part of the
 * same wizard rather than as a screen somebody else built.
 */
function PickCard({
  atlasKey,
  title,
  meta,
  selected,
  suggested,
  onPick,
}: {
  atlasKey: string;
  title: string;
  meta?: string | null;
  selected: boolean;
  suggested?: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={cn(
        "group relative block aspect-[16/10] w-full overflow-hidden border bg-card text-left transition-colors",
        selected
          ? "border-ember"
          : suggested
            ? "border-accent/70"
            : "border-hairline hover:border-ember/60",
      )}
    >
      <PlaceArt atlasKey={atlasKey} label={title} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/45 to-transparent" />
      {selected && (
        <span className="absolute right-2 top-2 z-10 bg-ember px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-background">
          Home
        </span>
      )}
      {!selected && suggested && (
        <span className="absolute right-2 top-2 z-10 border border-accent/70 bg-background/80 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-accent">
          Familiar
        </span>
      )}
      <div className="absolute inset-x-3 bottom-2">
        {/* Wrapped rather than truncated: at two cards to a row on a phone,
            "Coronado Heig…" and "Eagle Rock Sta…" are not names. */}
        <h3 className="line-clamp-2 text-sm font-bold leading-tight tracking-tight text-foreground">
          {title}
        </h3>
        {meta ? (
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.15em] text-text-dim">
            {meta}
          </p>
        ) : null}
      </div>
    </button>
  );
}

/** A back-step, so a decision three levels deep is never a trap. */
function ChangeLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-dim underline-offset-4 transition-colors hover:text-ember hover:underline"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// What living there would be like.
// ---------------------------------------------------------------------------

/**
 * How loudly to render "if it goes loud".
 *
 * This is the line the whole choice turns on — the container costs the same
 * everywhere, so response is the difference between one address and another —
 * and it earns colour. Read off the sentence the engine produced rather than
 * off a tier, because the tier is the engine's business.
 */
function responseTone(line: string | null): string {
  if (!line) return "text-text";
  if (/nobody comes/i.test(line)) return "text-accent";
  if (/at once/i.test(line)) return "text-ember";
  return "text-text";
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-hairline bg-surface-raised p-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-dim">{label}</dt>
      <dd className="mt-1 text-sm text-text">{children}</dd>
    </div>
  );
}

/** The chosen address, and what the atlas already knows about it. */
function HomeSpotlight({ preview, housingName }: { preview: HomePreview; housingName: string }) {
  const entry = placeDossier(preview.placeKey);
  const src = entry ? placeImage(entry) : undefined;
  return (
    <div className="overflow-hidden border border-ember/50 bg-card">
      <div className="relative h-44 border-b border-ember/30 sm:h-56">
        {src ? (
          <img
            src={src}
            alt={preview.placeName}
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <PlaceArt atlasKey={preview.placeKey} label={preview.placeName} />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
        <div className="absolute inset-x-4 bottom-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ember">
            {housingName} — {preview.districtName}
          </p>
          <h3 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {preview.placeName}
          </h3>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {preview.blurb ? (
          <p className="text-sm leading-relaxed text-foreground/90">{preview.blurb}</p>
        ) : null}

        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact label="If it goes loud">
            <span className={responseTone(preview.ifItGoesLoud)}>
              {preview.ifItGoesLoud ?? "Nobody has said."}
            </span>
          </Fact>
          <Fact label="Who claims this ground">
            {preview.gangs.length ? preview.gangs.join(", ") : "Nobody, officially."}
          </Fact>
        </dl>

        {preview.nearby.length ? (
          <div>
            <SectionTitle>Within walking distance</SectionTitle>
            <ul className="mt-2 space-y-1">
              {preview.nearby.map((near) => (
                <li key={`${near.label}-${near.placeName}`} className="text-sm text-text">
                  <span className="text-foreground">{near.label}</span>
                  <span className="text-text-dim"> at {near.placeName}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {preview.travel.length ? (
          <div>
            <SectionTitle>How far you are from things</SectionTitle>
            <ul className="mt-2 grid gap-1 sm:grid-cols-3">
              {preview.travel.map((leg) => (
                <li key={leg.to} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-text">{leg.name}</span>
                  <span className="shrink-0 font-mono tabular-nums text-text-dim">
                    {leg.minutes}m
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The picker.
// ---------------------------------------------------------------------------

/** The district a card should show a picture of. Districts have their own art. */
function districtMeta(district: District): string | null {
  const preview = homesIn(district.key)[0];
  const facts = preview ? homePreview(preview.key) : null;
  if (!facts) return null;
  return [facts.wealth, facts.crowd].filter(Boolean).join(" · ");
}

export function HomePicker({ state }: { state: ChargenState }) {
  const patch = useChargenStore((s) => s.patch);
  const plan = startingLifestylePlan(state.roleId);
  const { location, districtKey, placeKey } = state.lifestyle;
  const givenHousing = !plan.requiresLocation;

  // The character's own Lifepath answer, six steps back.
  const childhood = useMemo(() => {
    const entry = readGeneralLifepath(state.lifepath.general).entries["childhood_environment"];
    return entry ? displayValue(entry) : null;
  }, [state.lifepath.general]);

  const suggestion = useMemo(
    () => (location ? suggestedHomeIn(childhood, location) : suggestedHome(childhood)),
    [childhood, location],
  );
  const suggestedKeys = useMemo(() => new Set(suggestion?.districts ?? []), [suggestion]);

  const districts = useMemo(() => (location ? districtsInCategory(location) : []), [location]);
  const buildings: PlaceProfile[] = useMemo(() => {
    if (givenHousing) return execHomes();
    return districtKey ? homesIn(districtKey) : [];
  }, [givenHousing, districtKey]);

  const preview = placeKey ? homePreview(placeKey) : null;
  const stages = givenHousing ? 1 : 3;

  const pickCategory = (next: string) =>
    patch({ lifestyle: { location: next, districtKey: null, placeKey: null } });
  const pickDistrict = (next: string) =>
    patch({ lifestyle: { ...state.lifestyle, districtKey: next, placeKey: null } });
  const pickBuilding = (next: string) => {
    // The Exec picks a building without a district above it, so the district is
    // read off the building rather than chosen. Everyone else already has one,
    // and it is the one the building is in.
    patch({
      lifestyle: {
        ...state.lifestyle,
        districtKey: homePreview(next)?.districtKey ?? state.lifestyle.districtKey,
        placeKey: next,
      },
    });
  };

  return (
    <div className="space-y-5">
      {/* Stage 1 — the printed choice. Not shown to a Role that is given housing. */}
      {!givenHousing && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Stage n={1} of={stages} label="Which half of the city" />
            {location ? (
              <ChangeLink onClick={() => pickCategory(location)}>Reset</ChangeLink>
            ) : null}
          </div>
          <p className="text-sm text-text">
            You start in a rented <span className="text-ember">{plan.housingName}</span> on a{" "}
            <span className="text-ember">{plan.lifestyleName}</span> Lifestyle. The rent is the same
            wherever it sits — what changes is who your neighbours are.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {plan.locations.map((category) => {
              const selected = location === category;
              const count = districtsInCategory(category).length;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => pickCategory(category)}
                  aria-pressed={selected}
                  className={cn(
                    "border p-4 text-left transition-colors duration-200",
                    selected
                      ? "border-ember bg-ember/10"
                      : "border-hairline bg-surface-raised hover:border-ember/60",
                  )}
                >
                  <span className="font-mono text-sm uppercase tracking-[0.15em] text-text">
                    {category}
                  </span>
                  <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.15em] text-text-dim">
                    {count} {count === 1 ? "district" : "districts"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* The Lifepath, remembering where this character came from. Shown only
          where it can point at something: an Exec is housed wherever their
          corporation houses them, so telling them Reclaimer ground would feel
          like home is a sentence with nowhere to go. */}
      {suggestion && !givenHousing && !placeKey ? (
        <p className="border-l-2 border-accent/70 bg-surface-raised/60 py-2 pl-3 text-sm italic text-text">
          {suggestion.line}
        </p>
      ) : null}

      {/* Stage 2 — the district. */}
      {!givenHousing && location ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Stage n={2} of={stages} label="Which district" />
            {districtKey ? (
              <ChangeLink onClick={() => pickDistrict(districtKey)}>Reset</ChangeLink>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {districts.map((district) => (
              <PickCard
                key={district.key}
                atlasKey={district.key}
                title={district.name}
                meta={districtMeta(district)}
                selected={districtKey === district.key}
                suggested={suggestedKeys.has(district.key)}
                onPick={() => pickDistrict(district.key)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Stage 3 — the building. The Exec's only stage. */}
      {buildings.length ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Stage
              n={stages}
              of={stages}
              label={givenHousing ? "Whose building" : "Which building"}
            />
            {placeKey ? (
              <ChangeLink
                onClick={() => patch({ lifestyle: { ...state.lifestyle, placeKey: null } })}
              >
                Reset
              </ChangeLink>
            ) : null}
          </div>
          {givenHousing ? (
            <p className="text-sm text-text">
              Your Role Ability hands you a <span className="text-ember">{plan.housingName}</span>{" "}
              at <span className="text-ember">no rent</span>. Pick whose name is on the lobby.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {buildings.map((building) => (
              <PickCard
                key={building.key}
                atlasKey={building.key}
                title={building.name}
                meta={givenHousing ? (homePreview(building.key)?.districtName ?? null) : null}
                selected={placeKey === building.key}
                onPick={() => pickBuilding(building.key)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* What you chose, and what it will mean. */}
      {preview ? <HomeSpotlight preview={preview} housingName={plan.housingName} /> : null}
    </div>
  );
}
