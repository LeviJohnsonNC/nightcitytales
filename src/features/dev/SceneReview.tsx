import { useCallback, useMemo, useState } from "react";
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

const REVIEW_WEAPON = weaponProfile("very_heavy_pistol");
const STORAGE = "nct-scene-review-v1";
export function SceneReview() {
  const [kind, setKind] = useState<SceneEnvironment["recipe"]>("intersection");
  const [seed, setSeed] = useState(1);
  const [actors, setActors] = useState(false);
  const [planVisible, setPlanVisible] = useState(false);
  const [entrances, setEntrances] = useState(false);
  const [damage, setDamage] = useState("intact");
  const [saved, setSaved] = useState<ReturnType<typeof readSceneReview> | null>(null);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const generated = useMemo(() => composeScene(kind, seed), [kind, seed]);
  const scene = saved?.scene ?? generated;
  const live = useMemo(() => {
    if (saved) return saved.live;
    const fixture = sceneReviewEncounter(scene, entrances);
    fixture.cover = Object.fromEntries(
      scene.layout.arena.cover!.map((c) => [
        c.id,
        damage === "destroyed" ? coverMaxHp(c) : damage === "damaged" ? 1 : 0,
      ]),
    );
    return fixture;
  }, [scene, entrances, damage, saved]);
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
          </select>
        </label>
        <label>
          Variation
          <select
            value={seed}
            onChange={(e) => {
              reset();
              setSeed(Number(e.target.value));
            }}
          >
            <option value={1}>1 · First layout</option>
            <option value={2}>2 · Second layout</option>
            <option value={3}>3 · Third layout</option>
          </select>
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
              setSeed(environment.seed);
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
      </header>
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
          title="Scene readability review"
          objective="Inspect only · no campaign writes"
        />
      ) : (
        <div className="scene-review-canvas">
          <CourtyardLayer
            key={scene.layout.arena.key}
            live={empty}
            camera={{ x: 0, y: 0, zoom }}
            onReady={onReady}
            onFailure={onFailure}
          />
        </div>
      )}
    </main>
  );
}
