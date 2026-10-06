/**
 * NCAmp: Night City's finest media player.
 *
 * The creator's music, played through a faithful homage to the player that
 * owned every desktop in 1999 — drawn from scratch, none of the original's
 * artwork. It lives in the creator's top bar as the classic one-line
 * "windowshade" strip, and the ▾ (or a click on the title) drops down the full
 * stack beneath it: the main window, the ten-band equalizer, the playlist.
 *
 * All of it reads one state (`subscribePlayer`) and calls the director's
 * controls; it holds nothing about the music itself. What it does keep is how
 * the player likes it laid out — skin, which windows are open, double size,
 * the visualizer, elapsed or remaining — in this browser only.
 *
 * Three skins. Street, the default, is drawn in the creator's own panels,
 * hairlines and type so it sits in the bar like the rest of the page; only the
 * scrolling title keeps the pixel font. Classic is the grey, gold and LCD
 * green of the original, and Neon is that shape lit in the app's colours.
 * The Skin row atop the open player chooses between them, and the O in the
 * clutterbar still cycles them, as options always did.
 *
 * The dice button in the strip is the creator's one switch for dice sound:
 * the music and the rolls answer to the same player.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  isDiceSoundEnabled,
  onDiceSoundChange,
  playSettle,
  setDiceSoundEnabled,
} from "@/features/dice/fx";
import { cn } from "@/lib/utils";
import { EQ_BANDS, EQ_PRESETS, EQ_RANGE_DB, bandLabel, clampDb } from "../equalizer";
import {
  getPlayerState,
  next,
  pause,
  play,
  playTrack,
  previous,
  sampleRateKhz,
  seek,
  setBalance,
  setEq,
  setPlaylist,
  setRepeat,
  setShuffle,
  setVolume,
  stop,
  subscribePlayer,
  surveyTracks,
  type PlayerState,
} from "../musicDirector";
import { PLAYLISTS, playlistDef } from "../soundtrack";
import { TRACK_ARTIST, formatTime, trackTitle } from "../trackTitles";
import {
  Btn,
  Digits,
  GlyphIcon,
  Marquee,
  Slider,
  Visualizer,
  type Glyph,
  type VisMode,
} from "./parts";
import "./ncamp.css";

type Skin = "street" | "classic" | "night";
type Ui = {
  skin: Skin;
  /** Which default the saved skin was chosen against; see `readUi`. */
  skinRev: number;
  open: boolean;
  eq: boolean;
  pl: boolean;
  double: boolean;
  vis: VisMode;
  remaining: boolean;
};

const UI_KEY = "nct.ncamp.ui";
/**
 * Bumped when the default skin changes, so a player who never chose one (or
 * chose before Street existed) lands on the new default once.
 */
const SKIN_REV = 2;
const DEFAULT_UI: Ui = {
  skin: "street",
  skinRev: SKIN_REV,
  open: false,
  eq: true,
  pl: true,
  double: false,
  vis: "spectrum",
  remaining: false,
};
const SKINS: Skin[] = ["street", "classic", "night"];
const SKIN_NAMES: Record<Skin, string> = { street: "Street", classic: "Classic", night: "Neon" };
const IDLE_TEXT = "NCAMP 2077  ***  NIGHT CITY'S FINEST MEDIA PLAYER";
const BLOCKED_TEXT = "PRESS PLAY  ***  THE BROWSER IS HOLDING THE MUSIC UNTIL YOU DO";

function readUi(): Ui {
  try {
    const raw = JSON.parse(localStorage.getItem(UI_KEY) ?? "null") as Partial<Ui> | null;
    const ui = { ...DEFAULT_UI, ...(raw ?? {}), open: false };
    if (ui.skinRev !== SKIN_REV || !SKINS.includes(ui.skin)) {
      return { ...ui, skin: DEFAULT_UI.skin, skinRev: SKIN_REV };
    }
    return ui;
  } catch {
    return DEFAULT_UI;
  }
}

/** How the player is laid out, remembered in this browser. Always starts collapsed. */
function useUi(): [Ui, (patch: Partial<Ui>) => void] {
  const [ui, setUi] = useState<Ui>(DEFAULT_UI);
  useEffect(() => setUi(readUi()), []);
  const update = useCallback(
    (patch: Partial<Ui>) =>
      setUi((was) => {
        const now = { ...was, ...patch };
        try {
          localStorage.setItem(UI_KEY, JSON.stringify(now));
        } catch {
          /* ignore */
        }
        return now;
      }),
    [],
  );
  return [ui, update];
}

/** "3. Night City Tales - Badlands Highway (3:45)". */
function lineFor(state: PlayerState, track: string | null): string {
  // Something else is scoring the moment; say what, and that the playlist is waiting.
  if (state.held) return `${state.held.toUpperCase()}  ***  THE PLAYLIST WAITS`;
  if (!track) return IDLE_TEXT;
  const n = state.tracks.indexOf(track) + 1;
  const length = state.durations[track];
  return `${n > 0 ? `${n}. ` : ""}${TRACK_ARTIST} - ${trackTitle(track)}${
    length ? ` (${formatTime(length)})` : ""
  }`;
}

/** "04:21", or "-3:07" counting down; blank while stopped. */
function clockText(state: PlayerState, remaining: boolean): string {
  if (state.status === "stopped") return "  :  ";
  const secs = remaining ? Math.max(0, state.duration - state.position) : state.position;
  const whole = Math.floor(secs);
  const m = Math.min(99, Math.floor(whole / 60));
  const s = String(whole % 60).padStart(2, "0");
  return remaining ? `-${m}:${s}`.padStart(5, " ") : `${String(m).padStart(2, "0")}:${s}`;
}

const TRANSPORT: { glyph: Glyph; label: string; run: () => void }[] = [
  { glyph: "prev", label: "Previous (Z)", run: previous },
  { glyph: "play", label: "Play (X)", run: play },
  { glyph: "pause", label: "Pause (C)", run: pause },
  { glyph: "stop", label: "Stop (V)", run: stop },
  { glyph: "next", label: "Next (B)", run: next },
];

export function NCAmp() {
  const state = useSyncExternalStore(subscribePlayer, getPlayerState, getPlayerState);
  const [ui, setUi] = useUi();

  // Lengths and bitrates only matter once the full player is showing.
  useEffect(() => {
    if (ui.open) surveyTracks();
  }, [ui.open]);

  // The classic keys, only while the player is open and never while typing.
  useEffect(() => {
    if (!ui.open) return;
    const keys: Record<string, () => void> = { z: previous, x: play, c: pause, v: stop, b: next };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") return setUi({ open: false });
      const run = keys[e.key.toLowerCase()];
      if (!run) return;
      e.preventDefault();
      run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ui.open, setUi]);

  // The windows open over the page, not inside the bar that holds the strip. The bar
  // sits in its own stacking context (a sticky, blurred header), which capped them
  // at its z-index: the game's later controls painted through them. So they are
  // rendered on the body, fixed under the strip and kept there as the page scrolls.
  const anchor = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  useLayoutEffect(() => {
    if (!ui.open) return;
    let frame = 0;
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = anchor.current?.getBoundingClientRect();
        if (r) setAt({ top: r.bottom, right: document.documentElement.clientWidth - r.right });
      });
    };
    const r = anchor.current?.getBoundingClientRect();
    if (r) setAt({ top: r.bottom, right: document.documentElement.clientWidth - r.right });
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [ui.open]);

  const nextVis = (): VisMode =>
    ui.vis === "spectrum" ? "scope" : ui.vis === "scope" ? "off" : "spectrum";
  const text = state.blocked ? BLOCKED_TEXT : lineFor(state, state.track);

  return (
    <div className="ncamp" data-skin={ui.skin} ref={anchor}>
      <Shade
        state={state}
        ui={ui}
        text={text}
        onToggle={() => setUi({ open: !ui.open })}
        onVis={() => setUi({ vis: nextVis() })}
      />
      {ui.open &&
        at &&
        createPortal(
          <div
            className="ncamp ncamp-layer"
            data-skin={ui.skin}
            style={{ top: at.top, right: at.right }}
          >
            <div
              className="ncamp-stack"
              role="dialog"
              aria-label="NCAmp"
              style={{ zoom: ui.double ? 2 : 1.5 }}
            >
              <SkinRow skin={ui.skin} onChange={(skin) => setUi({ skin })} />
              <MainWindow
                state={state}
                ui={ui}
                text={text}
                setUi={setUi}
                onVis={() => setUi({ vis: nextVis() })}
              />
              {ui.eq && <EqWindow state={state} onClose={() => setUi({ eq: false })} />}
              {ui.pl && <PlaylistWindow state={state} onClose={() => setUi({ pl: false })} />}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// ── windowshade: the strip in the bar ────────────────────────────────────

function Shade({
  state,
  ui,
  text,
  onToggle,
  onVis,
}: {
  state: PlayerState;
  ui: Ui;
  text: string;
  onToggle: () => void;
  onVis: () => void;
}) {
  const time =
    state.status === "stopped"
      ? ""
      : formatTime(ui.remaining ? state.duration - state.position : state.position);
  const progress = state.duration ? Math.min(1, state.position / state.duration) : 0;
  return (
    <div
      className="ncamp-shade"
      data-status={state.status}
      style={{ "--ncamp-progress": progress } as CSSProperties}
    >
      <button
        type="button"
        className="ncamp-shade-title"
        onClick={onToggle}
        title={ui.open ? "Close NCAmp" : "Open NCAmp"}
        aria-expanded={ui.open}
      >
        <Marquee text={text} />
      </button>
      <div className="ncamp-shade-vis">
        <Visualizer width={38} height={7} bar={1} mode={ui.vis} skin={ui.skin} onClick={onVis} />
      </div>
      <span className={cn("ncamp-shade-time", state.status === "paused" && "is-blink")}>
        {time}
      </span>
      <div className="ncamp-shade-buttons">
        {TRANSPORT.map((t) => (
          <Btn
            key={t.glyph}
            label={t.label}
            onClick={t.run}
            className={cn("ncamp-mini", t.glyph === "play" && state.blocked && "is-beckon")}
          >
            <GlyphIcon glyph={t.glyph} />
          </Btn>
        ))}
      </div>
      <Btn
        label={ui.open ? "Close NCAmp" : "Open NCAmp"}
        onClick={onToggle}
        className="ncamp-mini ncamp-expand"
      >
        <svg viewBox="0 0 8 8" aria-hidden className="ncamp-glyph">
          <path d={ui.open ? "M1 6l3-4 3 4z" : "M1 2l3 4 3-4z"} />
        </svg>
      </Btn>
      <DiceSoundButton />
    </div>
  );
}

/** Dice sound on or off: the one switch for it, lit while the dice have a voice. */
function DiceSoundButton() {
  const [on, setOn] = useState(true);
  // The saved choice is read on the client only, so the server render matches.
  useEffect(() => {
    setOn(isDiceSoundEnabled());
    return onDiceSoundChange(setOn);
  }, []);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Dice sound"
      title={on ? "Dice sound on" : "Dice sound off"}
      className={cn("ncamp-btn ncamp-mini ncamp-dice", on && "is-on")}
      onClick={() => {
        setDiceSoundEnabled(!on);
        if (!on) playSettle(8, 10);
      }}
    >
      <svg viewBox="0 0 8 8" aria-hidden className="ncamp-glyph">
        {/* A die showing three, its pips cut through. */}
        <path
          fillRule="evenodd"
          d="M1.5 .5h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1zM1.75 1.75v1.25h1.25V1.75zM3.375 3.375v1.25h1.25v-1.25zM5 5v1.25h1.25V5z"
        />
        {!on && <path d="M.2 7.1L7.1.2l.7.7L.9 7.8z" className="ncamp-dice-off" />}
      </svg>
    </button>
  );
}

/** The skins, by name, atop the open player: where anyone would look for them. */
function SkinRow({ skin, onChange }: { skin: Skin; onChange: (skin: Skin) => void }) {
  return (
    <div className="ncamp-window ncamp-skins" role="radiogroup" aria-label="Skin">
      <span className="ncamp-skins-label">SKIN</span>
      {SKINS.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={skin === s}
          className={cn("ncamp-skins-btn", skin === s && "is-on")}
          onClick={() => onChange(s)}
        >
          {SKIN_NAMES[s]}
        </button>
      ))}
    </div>
  );
}

// ── the frame every window shares ────────────────────────────────────────

function TitleBar({
  title,
  onShade,
  onClose,
}: {
  title: string;
  onShade?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="ncamp-titlebar" onDoubleClick={onShade}>
      <span className="ncamp-titlebar-stripes" aria-hidden />
      <span className="ncamp-titlebar-text">{title}</span>
      <span className="ncamp-titlebar-stripes" aria-hidden />
      {onShade && (
        <button
          type="button"
          className="ncamp-tb-btn"
          onClick={onShade}
          title="Windowshade"
          aria-label="Windowshade"
        >
          <span aria-hidden>▬</span>
        </button>
      )}
      {onClose && (
        <button
          type="button"
          className="ncamp-tb-btn"
          onClick={onClose}
          title="Close"
          aria-label="Close"
        >
          <span aria-hidden>×</span>
        </button>
      )}
    </div>
  );
}

// ── main window ──────────────────────────────────────────────────────────

function MainWindow({
  state,
  ui,
  text,
  setUi,
  onVis,
}: {
  state: PlayerState;
  ui: Ui;
  text: string;
  setUi: (patch: Partial<Ui>) => void;
  onVis: () => void;
}) {
  const kbps = state.track ? state.bitrates[state.track] : undefined;
  const glyph: Glyph =
    state.status === "playing" ? "play" : state.status === "paused" ? "pause" : "stop";
  const progress = state.duration ? state.position / state.duration : 0;
  const balanceText =
    state.balance === 0
      ? "Centre"
      : `${Math.round(Math.abs(state.balance) * 100)}% ${state.balance < 0 ? "left" : "right"}`;

  return (
    <section className="ncamp-window ncamp-main" aria-label="NCAmp main window">
      <TitleBar
        title="NCAMP"
        onShade={() => setUi({ open: false })}
        onClose={() => setUi({ open: false })}
      />

      <div className="ncamp-clutter" role="group" aria-label="Options">
        <button
          type="button"
          title={`Skin: ${SKIN_NAMES[ui.skin]} (click to change)`}
          aria-label={`Skin: ${SKIN_NAMES[ui.skin]}. Change skin`}
          onClick={() => setUi({ skin: SKINS[(SKINS.indexOf(ui.skin) + 1) % SKINS.length]! })}
        >
          O
        </button>
        <button
          type="button"
          disabled
          title="Always on top: it already is"
          aria-label="Always on top"
        >
          A
        </button>
        <button type="button" disabled title="File info" aria-label="File info">
          I
        </button>
        <button
          type="button"
          title="Double size"
          aria-label="Double size"
          aria-pressed={ui.double}
          className={cn(ui.double && "is-on")}
          onClick={() => setUi({ double: !ui.double })}
        >
          D
        </button>
        <button
          type="button"
          title="Visualization"
          aria-label="Change visualization"
          onClick={onVis}
        >
          V
        </button>
      </div>

      <div className="ncamp-lcd ncamp-display">
        <span className="ncamp-status" data-status={state.status}>
          <GlyphIcon glyph={glyph} />
        </span>
        <button
          type="button"
          className={cn("ncamp-clock", state.status === "paused" && "is-blink")}
          onClick={() => setUi({ remaining: !ui.remaining })}
          title={
            ui.remaining
              ? "Time remaining (click for elapsed)"
              : "Time elapsed (click for remaining)"
          }
          aria-label={`${ui.remaining ? "Remaining" : "Elapsed"} ${formatTime(ui.remaining ? state.duration - state.position : state.position)}`}
        >
          <Digits text={clockText(state, ui.remaining)} />
        </button>
        <div className="ncamp-display-vis">
          <Visualizer width={76} height={16} mode={ui.vis} skin={ui.skin} onClick={onVis} />
        </div>
      </div>

      <div className="ncamp-lcd ncamp-info-title">
        <Marquee text={text} />
      </div>
      <div className="ncamp-info-row">
        <span className="ncamp-lcd ncamp-num">{kbps ?? ""}</span>
        <span className="ncamp-unit">kbps</span>
        <span className="ncamp-lcd ncamp-num is-short">{state.track ? sampleRateKhz() : ""}</span>
        <span className="ncamp-unit">kHz</span>
        <span className={cn("ncamp-unit ncamp-lamp", state.status !== "stopped" && "is-dim")}>
          mono
        </span>
        <span className={cn("ncamp-unit ncamp-lamp", state.status !== "stopped" && "is-lit")}>
          stereo
        </span>
      </div>

      <div className="ncamp-row ncamp-levels">
        <Slider
          label="Volume"
          value={state.volume}
          onChange={setVolume}
          className="ncamp-volume"
          valueText={`${Math.round(state.volume * 100)}%`}
        />
        <Slider
          label="Balance"
          value={(state.balance + 1) / 2}
          onChange={(v) => setBalance(v * 2 - 1)}
          className="ncamp-balance"
          disabled={!state.analysable}
          valueText={balanceText}
        />
        <Btn
          label="Equalizer"
          pressed={ui.eq}
          onClick={() => setUi({ eq: !ui.eq })}
          className="ncamp-toggle"
        >
          EQ
        </Btn>
        <Btn
          label="Playlist"
          pressed={ui.pl}
          onClick={() => setUi({ pl: !ui.pl })}
          className="ncamp-toggle"
        >
          PL
        </Btn>
      </div>

      <Slider
        label="Seek"
        value={progress}
        onChange={seek}
        className="ncamp-seek"
        disabled={state.status === "stopped"}
        valueText={`${formatTime(state.position)} of ${formatTime(state.duration)}`}
      />

      <div className="ncamp-row ncamp-transport">
        {TRANSPORT.map((t) => (
          <Btn
            key={t.glyph}
            label={t.label}
            onClick={t.run}
            className={cn("ncamp-big", t.glyph === "play" && state.blocked && "is-beckon")}
          >
            <GlyphIcon glyph={t.glyph} />
          </Btn>
        ))}
        <Btn label="Open file: not on a street deck" disabled className="ncamp-eject">
          <GlyphIcon glyph="eject" />
        </Btn>
        <Btn
          label="Shuffle"
          pressed={state.shuffle}
          onClick={() => setShuffle(!state.shuffle)}
          className="ncamp-toggle ncamp-shuffle"
        >
          SHUFFLE
        </Btn>
        <Btn
          label="Repeat"
          pressed={state.repeat}
          onClick={() => setRepeat(!state.repeat)}
          className="ncamp-toggle ncamp-repeat"
        >
          REP
        </Btn>
        <span className="ncamp-logo" aria-hidden>
          NC
        </span>
      </div>
    </section>
  );
}

// ── equalizer ────────────────────────────────────────────────────────────

/** A dB value as a slider position, 1 at the top. */
const dbToUnit = (db: number) => (db + EQ_RANGE_DB) / (EQ_RANGE_DB * 2);
const unitToDb = (u: number) => clampDb(u * EQ_RANGE_DB * 2 - EQ_RANGE_DB);

function EqWindow({ state, onClose }: { state: PlayerState; onClose: () => void }) {
  const [presetsOpen, setPresetsOpen] = useState(false);
  const eq = state.eq;
  const off = !state.analysable;
  // The response curve: a line through the bands, like the little graph up top.
  const points = eq.bands
    .map((db, i) => `${(i / (eq.bands.length - 1)) * 109 + 2},${9 - (db / EQ_RANGE_DB) * 8}`)
    .join(" ");

  return (
    <section className="ncamp-window ncamp-eq" aria-label="NCAmp equalizer">
      <TitleBar title="NCAMP EQUALIZER" onClose={onClose} />
      <div className="ncamp-row ncamp-eq-top">
        <Btn
          label="Equalizer on"
          pressed={eq.on}
          onClick={() => setEq({ ...eq, on: !eq.on })}
          className="ncamp-toggle"
          disabled={off}
        >
          ON
        </Btn>
        <Btn label="Auto-load presets: not in this build" disabled className="ncamp-toggle">
          AUTO
        </Btn>
        <svg viewBox="0 0 113 19" className="ncamp-lcd ncamp-eq-curve" aria-hidden>
          <line x1="0" x2="113" y1="9.5" y2="9.5" className="ncamp-eq-zero" />
          <polyline points={points} className="ncamp-eq-line" />
        </svg>
        <div className="ncamp-presets">
          <Btn
            label="Presets"
            onClick={() => setPresetsOpen((o) => !o)}
            className="ncamp-toggle"
            disabled={off}
          >
            PRESETS
          </Btn>
          {presetsOpen && (
            <ul className="ncamp-menu" role="menu">
              {Object.entries(EQ_PRESETS).map(([name, bands]) => (
                <li key={name} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setEq({ on: true, preamp: eq.preamp, bands });
                      setPresetsOpen(false);
                    }}
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="ncamp-eq-sliders">
        <div className="ncamp-eq-band">
          <Slider
            vertical
            label="Preamp"
            value={dbToUnit(eq.preamp)}
            onChange={(u) => setEq({ ...eq, preamp: unitToDb(u) })}
            disabled={off}
            valueText={`${eq.preamp > 0 ? "+" : ""}${eq.preamp} dB`}
          />
          <span className="ncamp-eq-label">PREAMP</span>
        </div>
        <div className="ncamp-eq-scale" aria-hidden>
          <span>+12db</span>
          <span>+0db</span>
          <span>-12db</span>
        </div>
        {EQ_BANDS.map((hz, i) => (
          <div key={hz} className="ncamp-eq-band">
            <Slider
              vertical
              label={`${bandLabel(hz)} Hz`}
              value={dbToUnit(eq.bands[i] ?? 0)}
              onChange={(u) => {
                const bands = [...eq.bands];
                bands[i] = unitToDb(u);
                setEq({ ...eq, bands });
              }}
              disabled={off}
              valueText={`${(eq.bands[i] ?? 0) > 0 ? "+" : ""}${eq.bands[i] ?? 0} dB`}
            />
            <span className="ncamp-eq-label">{bandLabel(hz)}</span>
          </div>
        ))}
      </div>
      {off && <p className="ncamp-eq-note">EQ needs the tracks served from this site</p>}
    </section>
  );
}

// ── playlist ─────────────────────────────────────────────────────────────

function PlaylistWindow({ state, onClose }: { state: PlayerState; onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const known = state.tracks.map((t) => state.durations[t]).filter((d): d is number => !!d);
  const total = known.reduce((a, b) => a + b, 0);
  const upTo =
    state.track && state.tracks.includes(state.track)
      ? state.tracks
          .slice(0, state.tracks.indexOf(state.track))
          .reduce((sum, t) => sum + (state.durations[t] ?? 0), 0) + state.position
      : 0;

  function move(by: number) {
    const i = selected ? state.tracks.indexOf(selected) : -1;
    const n = state.tracks[Math.max(0, Math.min(state.tracks.length - 1, i + by))];
    if (n) setSelected(n);
  }

  return (
    <section className="ncamp-window ncamp-pl" aria-label="NCAmp playlist">
      <TitleBar title="NCAMP PLAYLIST" onClose={onClose} />
      <div className="ncamp-pl-tabs" role="group" aria-label="Playlist">
        {PLAYLISTS.map((list) => (
          <Btn
            key={list.id}
            label={`${list.name}: ${list.blurb}`}
            pressed={state.list === list.id}
            onClick={() => {
              setSelected(null);
              setPlaylist(list.id);
            }}
            className="ncamp-toggle ncamp-pl-tab"
          >
            {list.short}
          </Btn>
        ))}
      </div>
      <ol
        className="ncamp-lcd ncamp-pl-list"
        tabIndex={0}
        aria-label={`${playlistDef(state.list).name}. Double-click or press Enter to play a track.`}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") move(1);
          else if (e.key === "ArrowUp") move(-1);
          else if (e.key === "Enter" && selected) playTrack(selected);
          else return;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {state.tracks.map((track, i) => (
          <li
            key={track}
            className={cn(
              "ncamp-pl-row",
              track === state.track && "is-current",
              track === selected && "is-selected",
            )}
            onClick={() => setSelected(track)}
            onDoubleClick={() => playTrack(track)}
            aria-current={track === state.track ? "true" : undefined}
          >
            <span className="ncamp-pl-name">
              {i + 1}. {TRACK_ARTIST} - {trackTitle(track)}
            </span>
            <span className="ncamp-pl-time">{formatTime(state.durations[track])}</span>
          </li>
        ))}
        {state.tracks.length === 0 && (
          <li className="ncamp-pl-row">No tracks in this playlist yet.</li>
        )}
      </ol>
      <div className="ncamp-pl-bottom">
        <div className="ncamp-row">
          {["ADD", "REM", "SEL", "MISC"].map((label) => (
            <Btn
              key={label}
              label={`${label}: not on a street deck`}
              disabled
              className="ncamp-toggle ncamp-pl-btn"
            >
              {label}
            </Btn>
          ))}
        </div>
        <div className="ncamp-pl-right">
          <span className="ncamp-lcd ncamp-pl-total">
            {formatTime(upTo)}/{total ? formatTime(total) : "--:--"}
          </span>
          <div className="ncamp-row">
            {TRANSPORT.map((t) => (
              <Btn key={t.glyph} label={t.label} onClick={t.run} className="ncamp-micro">
                <GlyphIcon glyph={t.glyph} />
              </Btn>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
