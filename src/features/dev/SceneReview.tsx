import { useCallback, useMemo, useState } from "react";
import {
  composeScene,
  weaponProfile,
  coverMaxHp,
  EMPTY_TURN_ECONOMY,
  type CapabilitySnapshot,
} from "@/engine";
import { CombatBoard } from "@/features/play/CombatBoard";
import { CourtyardLayer } from "@/features/play/courtyard/CourtyardLayer";
import { targetCapabilities } from "@/features/play/capabilityModel";
import { readSceneReview, sceneReviewEncounter } from "./sceneReviewModel";
import "./sceneReview.css";

const REVIEW_WEAPON = weaponProfile("very_heavy_pistol");
const STORAGE = "nct-scene-review-v1";
export function SceneReview() {
  const [kind, setKind] = useState<"intersection" | "alley">("intersection");
  const [seed, setSeed] = useState(1);
  const [actors, setActors] = useState(false);
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
          <p>Static fixtures · no campaign writes. Entrance markers lead to closed doors.</p>
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
            <option value={1}>1 · Corner / service court</option>
            <option value={2}>2 · Offset / narrow passage</option>
            <option value={3}>3 · Cross-axis / wide passage</option>
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
          Entrance positions
        </label>
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
                (environment.entrances ?? []).some((entry, i) => {
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
