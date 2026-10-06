import { compositionDescription } from "@/engine/sceneComposition";
import {
  readReviewQuery,
  reviewQuery,
  reviewSeed,
  COMPOSITION_REVIEW_SEEDS,
} from "./sceneReviewQuery";
import { battlefieldCameraPreset } from "@/features/play/courtyard/courtyardPresentation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  composeScene,
  weaponProfile,
  coverMaxHp,
  EMPTY_TURN_ECONOMY,
  type CapabilitySnapshot,
  type SceneEnvironment,
} from "@/engine";
import { CombatBoard } from "@/features/play/CombatBoard";
import { CourtyardLayer } from "@/features/play/courtyard/CourtyardLayer";
import { targetCapabilities } from "@/features/play/capabilityModel";
import { readSceneReview, sceneReviewEncounter } from "./sceneReviewModel";
import "./sceneReview.css";
import { adventureSceneProof } from "./adventureSceneProof";

const REVIEW_WEAPON = weaponProfile("very_heavy_pistol");
const STORAGE = "nct-scene-review-v1";
export function SceneReview() {
  const [initial] = useState(() =>
    readReviewQuery(typeof window === "undefined" ? "" : window.location.search),
  );
  const [kind, setKind] = useState<SceneEnvironment["recipe"]>(initial.kind);
  const [seed, setSeed] = useState(initial.seed);
  const [adventure, setAdventure] = useState(initial.adventure);
  const [actors, setActors] = useState(initial.actors);
  const [planVisible, setPlanVisible] = useState(false);
  const [entrances, setEntrances] = useState(initial.entrances);
  const [damage, setDamage] = useState(initial.damage);
  const [saved, setSaved] = useState<ReturnType<typeof readSceneReview> | null>(null);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [rendererAttempt, setRendererAttempt] = useState(0);
  const [revealActivity, setRevealActivity] = useState(initial.revealActivity);
  const [lights, setLights] = useState(initial.lights);
  const [night, setNight] = useState(initial.night);
  const [zoom, setZoom] = useState(1);
  const [structureOnly, setStructureOnly] = useState(initial.structureOnly);
  const [framing, setFraming] = useState<"play" | "overview">(initial.framing);
  const generated = useMemo(
    () => saved?.scene ?? (adventure ? adventureSceneProof(kind, seed) : composeScene(kind, seed)),
    [kind, seed, adventure, saved],
  );
  const scene = saved?.scene ?? generated;
  const query = reviewQuery({
    kind,
    seed,
    adventure,
    actors,
    entrances,
    damage,
    structureOnly,
    revealActivity,
    lights,
    night,
    camera: initial.camera,
    player: initial.player,
    foe: initial.foe,
    framing,
  });
  useEffect(() => {
    if (!saved)
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?${query}`);
  }, [query, saved]);
  const selection = scene.layout.arena.environment?.composition;
  const reviewSeeds = COMPOSITION_REVIEW_SEEDS[kind];
  const live = useMemo(() => {
    if (saved) return saved.live;
    const fixture = sceneReviewEncounter(scene, entrances);
    // A capture can stand the review character anywhere open, e.g. under the shop's awning.
    const player = fixture.data["player"];
    if (initial.player && player) fixture.data["player"] = { ...player, position: initial.player };
    // and the first hostile, e.g. behind a stall, to check how a target reads there
    const foe = fixture.state.order.find((id) => fixture.state.combatants[id]?.side === "hostile");
    if (initial.foe && foe) fixture.data[foe] = { ...fixture.data[foe]!, position: initial.foe };
    fixture.cover = Object.fromEntries(
      scene.layout.arena.cover!.map((c, i) => [
        c.id,
        // mixed: every other piece destroyed, so one prop can show an intact section
        // beside a destroyed one, and intact and destroyed props share a frame
        damage === "destroyed" || (damage === "mixed" && i % 2 === 1)
          ? coverMaxHp(c)
          : damage === "damaged"
            ? 1
            : 0,
      ]),
    );
    return fixture;
  }, [scene, entrances, damage, saved, initial.player, initial.foe]);
  const empty = useMemo(
    () => ({ ...live, state: { ...live.state, order: [], combatants: {} }, data: {} }),
    [live],
  );
  const onReady = useCallback((value: boolean) => {
    setReady(value);
    if (value) setFailed(false);
  }, []);
  const onFailure = useCallback(() => {
    setReady(false);
    setFailed(true);
  }, []);
  const capability: CapabilitySnapshot = {
    hp: 40,
    hpMax: 40,
    woundState: "none",
    incapacitated: false,
    eurobucks: 0,
    luck: 0,
    move: 6,
    weapons: [
      { ...REVIEW_WEAPON, roundsLoaded: REVIEW_WEAPON.magazine, spareRounds: 0, broken: false },
    ],
    items: [],
    cyberware: [],
    roleAbility: null,
    vehicle: null,
    targets: targetCapabilities(live),
    turn: { ...EMPTY_TURN_ECONOMY, inCombat: true, isPlayerTurn: true, move: 6 },
    failedAttempts: [],
  };
  function reset() {
    setSaved(null);
    setMessage("");
  }
  return (
    <main className="scene-review">
      <header className="scene-review-controls">
        <div>
          <strong>Scene review</strong>
          <p>
            Static fixtures · no campaign writes. Interior doorways are open; exterior facade doors
            are closed.
          </p>
        </div>
        <label>
          Place
          <select
            value={kind}
            onChange={(e) => {
              reset();
              setKind(e.target.value as typeof kind);
            }}
          >
            <option value="intersection">Intersection</option>
            <option value="alley">Service alley</option>
            <option value="office">Office</option>
            <option value="nightclub">Nightclub</option>
            <option value="residential">Residential street</option>
            <option value="warehouse">Warehouse</option>
            <option value="garage">Garage</option>
          </select>
        </label>
        <label>
          Variation
          <select
            value={reviewSeeds.includes(seed) ? seed : "custom"}
            onChange={(e) => {
              reset();
              setSeed(Number(e.target.value));
            }}
          >
            {reviewSeeds.map((s, i) => (
              <option key={s} value={s}>
                {i + 1} · Seed {s}
                {s >= 1 && s <= 3 ? " · reference" : " · alternative"}
              </option>
            ))}
            {!reviewSeeds.includes(seed) && <option value="custom">Custom · Seed {seed}</option>}
          </select>
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const next = reviewSeed(String(new FormData(e.currentTarget).get("seed") ?? ""));
            if (next === null) {
              setMessage("Enter a whole seed from 0 to 4294967295.");
              return;
            }
            reset();
            setSeed(next);
          }}
        >
          <label>
            Seed{" "}
            <input
              key={seed}
              name="seed"
              aria-label="Scene seed"
              inputMode="numeric"
              defaultValue={seed}
              size={10}
            />
          </label>
          <button type="submit">Generate seed</button>
        </form>
        <label>
          <input
            type="checkbox"
            checked={adventure}
            onChange={(e) => {
              reset();
              setAdventure(e.target.checked);
              setEntrances(false);
            }}
          />
          Adventure context
        </label>
        <label>
          Cover
          <select
            value={damage}
            onChange={(e) => {
              reset();
              setDamage(e.target.value);
            }}
          >
            <option value="intact">Intact</option>
            <option value="damaged">Damaged</option>
            <option value="destroyed">Destroyed</option>
            <option value="mixed">Every other destroyed</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={actors} onChange={(e) => setActors(e.target.checked)} />
          Show characters / targeting
        </label>
        <label>
          <input
            type="checkbox"
            checked={entrances}
            onChange={(e) => {
              reset();
              setEntrances(e.target.checked);
            }}
          />
          Access positions
        </label>
        {scene.layout.arena.environment?.interior && (
          <label>
            <input
              type="checkbox"
              checked={planVisible}
              onChange={(e) => setPlanVisible(e.target.checked)}
            />
            Room/access plan
          </label>
        )}
        {scene.layout.arena.environment?.recipe === "intersection" && (
          <>
            <label>
              <input
                type="checkbox"
                checked={night}
                disabled={structureOnly}
                onChange={(e) => setNight(e.target.checked)}
              />
              Night
            </label>
            <label>
              <input
                type="checkbox"
                checked={lights}
                disabled={structureOnly || !night}
                onChange={(e) => setLights(e.target.checked)}
              />
              Lights
            </label>
          </>
        )}
        {!actors && (
          <>
            {!scene.layout.arena.environment?.interior && (
              <label>
                <input
                  type="checkbox"
                  checked={revealActivity}
                  disabled={structureOnly}
                  onChange={(e) => setRevealActivity(e.target.checked)}
                />
                Reveal activity behind buildings
              </label>
            )}
            <label>
              Composition
              <select
                value={structureOnly ? "structure" : "furnished"}
                onChange={(e) => setStructureOnly(e.target.value === "structure")}
              >
                <option value="furnished">Furniture and detail</option>
                <option value="structure">Structure only</option>
              </select>
            </label>
            <label>
              Framing
              <select
                value={framing}
                onChange={(e) => {
                  setFraming(e.target.value as typeof framing);
                  setZoom(1);
                }}
              >
                <option value="play">Play area</option>
                <option value="overview">Overview</option>
              </select>
            </label>
          </>
        )}
        {!actors && (
          <label>
            Zoom
            <input
              aria-label="Scenery zoom"
              type="range"
              min="0.7"
              max="1.6"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
        )}
        <button
          onClick={() => {
            try {
              localStorage.setItem(
                STORAGE,
                JSON.stringify({
                  scene,
                  reviewSeed: seed,
                  cover: live.cover,
                  positions: live.state.order.map((id) => live.data[id]!.position),
                }),
              );
              setMessage("Review snapshot saved in this browser.");
            } catch {
              setMessage("Browser storage is unavailable.");
            }
          }}
        >
          Save review
        </button>
        <button
          onClick={() => {
            try {
              const raw = localStorage.getItem(STORAGE);
              if (!raw) throw new Error();
              const restored = readSceneReview(JSON.parse(raw));
              const environment = restored.scene.layout.arena.environment!;
              setKind(environment.recipe);
              setAdventure(Boolean(restored.scene.context));
              setSeed(
                restored.reviewSeed ??
                  (restored.scene.context
                    ? ([1, 2, 3].find(
                        (i) =>
                          adventureSceneProof(environment.recipe, i).layout.arena.environment!
                            .seed === environment.seed,
                      ) ?? 1)
                    : environment.seed),
              );
              const cover = restored.scene.layout.arena.cover ?? [];
              setDamage(
                cover.every((c) => (restored.live.cover[c.id] ?? 0) >= coverMaxHp(c))
                  ? "destroyed"
                  : cover.some((c) => (restored.live.cover[c.id] ?? 0) > 0)
                    ? "damaged"
                    : "intact",
              );
              setEntrances(
                (
                  environment.interior?.access.filter((a) => a.id.endsWith("_approach")) ??
                  environment.entrances ??
                  []
                )
                  .slice(0, restored.live.state.order.length)
                  .some((entry, i) => {
                    const position = restored.live.data[restored.live.state.order[i]!]!.position;
                    return position.x === entry.position.x && position.y === entry.position.y;
                  }),
              );
              setSaved(restored);
              setMessage("Restored saved geometry, positions and damage.");
            } catch {
              setMessage("No valid saved review. Save a fixture first.");
            }
          }}
        >
          Load review
        </button>
        <p role="status">
          {message ||
            (actors
              ? "Inspect targets, routes and diagram view. No combat actions are submitted."
              : failed
                ? "Art failed to load. Switch on characters to use the board's diagram fallback."
                : ready
                  ? "Scenery only · shared shipping renderer"
                  : "Loading scenery…")}
        </p>
        {!actors && failed && (
          <button
            onClick={() => {
              setFailed(false);
              setReady(false);
              setMessage("");
              setRendererAttempt((n) => n + 1);
            }}
          >
            Retry scenery
          </button>
        )}
      </header>
      <p className="scene-review-summary">
        {selection ? compositionDescription(kind, selection) : scene.layout.arena.label}
        {" · Recipe v"}
        {scene.layout.arena.environment?.recipeVersion}
        {" · Scene seed "}
        {scene.layout.arena.environment?.seed}
        {saved ? (
          " · Frozen saved scene (not regenerated)"
        ) : (
          <>
            {" "}
            · <a href={`?${query}`}>Link to this seed and view</a>
          </>
        )}
        {selection?.rejected.map((reason, i) => (
          <span key={i}> · {reason}</span>
        ))}
      </p>
      {scene.context && (
        <details>
          <summary>Established adventure facts</summary>
          <p>
            {scene.context.facts.entities.map((e) => e.name).join(", ")};{" "}
            {scene.context.facts.objects.map((o) => o.label).join(", ")}.
          </p>
          <ul>
            {scene.context.facts.relationships.map((r) => (
              <li key={r.entity}>
                {scene.context!.facts.entities.find((e) => e.id === r.entity)?.name}{" "}
                {r.relation.replace("_", " ")}{" "}
                {scene.context!.facts.objects.find((o) => o.id === r.target)?.label ??
                  scene.context!.facts.entrances.find((e) => e.id === r.target)?.label ??
                  r.target}
              </li>
            ))}
          </ul>
        </details>
      )}
      {planVisible && scene.layout.arena.environment?.interior && (
        <figure className="scene-review-plan">
          <figcaption>
            Saved room plan · cyan openings · gold working-space anchors · dark walls remain solid
          </figcaption>
          <svg
            viewBox="0 0 32 32"
            role="img"
            aria-label="Saved room connections and working spaces"
          >
            <rect width="32" height="32" fill="#12212c" />
            {scene.layout.arena.environment.zones.map((z) => (
              <g key={z.id}>
                <rect
                  {...z.rect}
                  fill={
                    z.kind === "doorway" ? "#56cbbb" : z.kind === "dance" ? "#674778" : "#415b68"
                  }
                  stroke="#12212c"
                  strokeWidth=".15"
                />
                <text x={z.rect.x + 0.5} y={z.rect.y + 1.2} fontSize=".7" fill="#eef5f1">
                  {z.kind === "doorway" ? "" : z.id}
                </text>
              </g>
            ))}
            {scene.layout.arena.environment.interior.access.map((a) => (
              <circle key={a.id} cx={a.position.x} cy={a.position.y} r=".23" fill="#f6c777">
                <title>{a.label}</title>
              </circle>
            ))}
          </svg>
        </figure>
      )}
      {actors ? (
        <CombatBoard
          key={scene.layout.arena.key}
          live={live}
          capability={capability}
          weaponId={REVIEW_WEAPON.itemId}
          onWeaponId={() => {}}
          revealActivity={revealActivity}
          onRevealActivityChange={setRevealActivity}
          lights={lights}
          night={night}
          {...(initial.camera ? { initialCamera: initial.camera } : {})}
          title="Scene readability review"
          objective="Inspect only · no campaign writes"
        />
      ) : (
        <div className="scene-review-canvas">
          <CourtyardLayer
            key={`${scene.layout.arena.key}:${structureOnly}:${rendererAttempt}`}
            live={empty}
            structureOnly={structureOnly}
            revealActivity={revealActivity}
            lights={lights}
            night={night}
            camera={
              initial.camera ?? {
                ...battlefieldCameraPreset(scene.layout.arena, framing),
                zoom: battlefieldCameraPreset(scene.layout.arena, framing).zoom * zoom,
              }
            }
            onReady={onReady}
            onFailure={onFailure}
          />
        </div>
      )}
    </main>
  );
}
