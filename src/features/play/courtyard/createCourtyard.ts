import Phaser from "phaser";
import { arenaFor, coverStatuses } from "@/engine";
import type { LiveEncounter } from "@/features/campaign/encounterState";
import { battlefieldProjection } from "../battlefieldProjection";
import { frameDuration, type PlaybackFrame } from "../combatPlayback";
import { courtyardCamera } from "./courtyardPresentation";
import {
  animationCell,
  facingFor,
  movementSample,
  muzzleOffset,
  poseFor,
  SHOT_TIMING,
  CHARACTER_FRAME,
  type Facing,
} from "./characterAnimation";
import { clearMatte, createCharacterAtlas } from "./characterTextures";

export type CourtyardModel = {
  live: LiveEncounter;
  playback?: PlaybackFrame | null | undefined;
  aimTargetId?: string | null;
  camera: { x: number; y: number; zoom: number };
};
export type CourtyardRenderer = { sync: (model: CourtyardModel) => void; destroy: () => void };

type Unit = {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  facing: Facing;
};

export function createCourtyard(
  host: HTMLElement,
  initial: CourtyardModel,
  onReady: () => void,
  onFailure: () => void,
): CourtyardRenderer {
  let model = initial;
  let ready = false;
  let disposed = false;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const arena = arenaFor("night_shift");
  const { project } = battlefieldProjection(arena.extent.width, arena.extent.height);
  let started = 0;
  let previousLive: LiveEncounter | null = null;
  let previousFrame: PlaybackFrame | null | undefined;
  const units = new Map<string, Unit>();
  const scenery: Phaser.GameObjects.Image[] = [];

  class CourtyardScene extends Phaser.Scene {
    weather!: Phaser.GameObjects.Graphics;
    flash!: Phaser.GameObjects.Graphics;
    preload() {
      for (const key of ["ground", "crate", "mercenary-animation", "hostile-animation"])
        this.load.image(`source-${key}`, `/images/combat/night-shift/${key}.png`);
      this.load.on("loaderror", onFailure);
    }
    create() {
      if (disposed) return;
      if (
        ["ground", "crate", "mercenary-animation", "hostile-animation"].some(
          (key) => !this.textures.exists(`source-${key}`),
        )
      ) {
        onFailure();
        return;
      }
      try {
        for (const key of ["crate"]) {
          const source = this.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement;
          const width = 256;
          const height = Math.round((width * source.height) / source.width);
          const texture = this.textures.createCanvas(key, width, height)!;
          const ctx = texture.context;
          ctx.drawImage(source, 0, 0, width, height);
          clearMatte(ctx, width, height);
          texture.refresh();
          this.textures.remove(`source-${key}`);
        }
        createCharacterAtlas(this, "mercenary");
        createCharacterAtlas(this, "hostile");
      } catch {
        onFailure();
        return;
      }
      this.add.image(550, 350, "source-ground").setDisplaySize(1200, 800).setDepth(-1000);
      // Baked lighting establishes the look. Small additive pools support it.
      this.add
        .ellipse(295, 330, 300, 170, 0x17cced, 0.025)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(-900);
      this.weather = this.add.graphics().setDepth(2000);
      this.flash = this.add.graphics().setDepth(1500);
      ready = true;
      reconcile(this);
      resize();
      onReady();
    }
    override update(time: number) {
      if (!ready || disposed) return;
      const frame = model.playback;
      const elapsed = Math.max(0, Date.now() - (frame?.startedAt ?? started));
      const duration = frame ? frameDuration(frame) : 0;
      for (const [id, unit] of units) {
        const actor = model.live.state.combatants[id],
          data = model.live.data[id];
        if (!actor || !data) continue;
        let position = data.position;
        const moving = frame?.kind === "move" && frame.actorId === id && frame.path;
        if (moving) {
          const sample = movementSample(
            moving,
            motion.matches || frame.animate === false ? 1 : elapsed / duration,
          );
          if (sample.position) position = sample.position;
          if (sample.from && sample.to)
            unit.facing = facingFor(project(sample.from), project(sample.to), unit.facing);
        }
        const p = project(position);
        unit.container.setPosition(p.x, p.y).setDepth(p.y);
        let aim =
          actor.isPlayer && model.aimTargetId ? model.live.data[model.aimTargetId]?.position : null;
        if (frame?.actorId === id && (frame.kind === "attack" || frame.kind === "cover"))
          aim = frame.aim ?? (frame.targetId ? model.live.data[frame.targetId]?.position : null);
        if (aim && !moving) unit.facing = facingFor(p, project(aim), unit.facing);
        const pose = poseFor({
          actor,
          exitReason: data.exitReason,
          frame,
          elapsed,
          movementDuration: duration,
          reducedMotion: motion.matches,
        });
        const cell = animationCell(unit.facing, pose, elapsed, !actor.isPlayer);
        unit.sprite.setFrame(cell.frame).setFlipX(cell.flipX);
        const animated = !motion.matches && frame?.animate !== false;
        // A small recoil/settle supports the authored pose; feet never drive position.
        const recoil =
          pose === "fire" && animated
            ? Math.sin(
                Math.min(
                  1,
                  (elapsed - SHOT_TIMING.fire) / (SHOT_TIMING.recover - SHOT_TIMING.fire),
                ) * Math.PI,
              )
            : 0;
        const side = unit.facing.endsWith("e") ? 1 : -1;
        const fall =
          pose === "fall"
            ? Math.min(
                1,
                (elapsed - SHOT_TIMING.impact) / (SHOT_TIMING.settle - SHOT_TIMING.impact),
              )
            : 1;
        const breathe =
          pose === "aim" && !actor.defeated && animated
            ? Math.sin(time / 650 + id.length) * 0.35
            : 0;
        unit.sprite
          .setPosition(
            -side * recoil * 2,
            -recoil + breathe - (pose === "fall" ? (1 - fall) * 5 : 0),
          )
          .setAngle(pose === "hurt" && animated ? -side * 4 : 0);
        unit.sprite.setAlpha(actor.defeated && data.exitReason !== "dead" ? 0.4 : 1);
        if (actor.defeated && data.exitReason !== "dead") unit.sprite.setTint(0x879aa5);
        else unit.sprite.clearTint();
        unit.shadow.setSize(pose === "dead" || pose === "fall" ? 55 : 30, 12);
      }
      for (const prop of scenery) {
        if (prop.getData("destroyed")) continue;
        const obstructs = [...units.values()].some(
          ({ container: unit }) =>
            unit.y < prop.depth &&
            unit.y > prop.y - prop.displayHeight * 0.75 &&
            Math.abs(unit.x - prop.x) < prop.displayWidth * 0.4,
        );
        prop.setAlpha(obstructs ? 0.4 : 1);
      }
      this.weather.clear();
      if (!motion.matches) {
        this.weather.lineStyle(0.65, 0xbad8eb, 0.12);
        const count = host.clientWidth < 600 ? 22 : 48;
        for (let i = 0; i < count; i++) {
          const x = ((i * 139.7 + time * 0.027) % 1200) - 50;
          const y = ((i * 97.3 + time * 0.31) % 800) - 50;
          this.weather.lineBetween(x, y, x - 4, y + 13);
        }
      }
      this.flash.clear();
      if (
        frame &&
        ["attack", "cover"].includes(frame.kind) &&
        frame.attackStyle !== "melee" &&
        frame.animate !== false &&
        !motion.matches &&
        elapsed >= SHOT_TIMING.fire &&
        elapsed < SHOT_TIMING.impact + 80 &&
        frame.actorId
      ) {
        const unit = units.get(frame.actorId);
        const aim =
          frame.aim ?? (frame.targetId ? model.live.data[frame.targetId]?.position : null);
        if (unit && aim) {
          const muzzle = muzzleOffset(
              unit.facing,
              !model.live.state.combatants[frame.actorId]?.isPlayer,
            ),
            p = project(aim);
          const x = unit.container.x + unit.sprite.x + muzzle.x,
            y = unit.container.y + unit.sprite.y + muzzle.y;
          this.flash
            .lineStyle(2, 0xffd599, 0.8)
            .lineBetween(x, y, p.x, p.y - (frame.kind === "cover" ? 16 : 42));
          this.flash.fillStyle(0xffd599, 0.24).fillCircle(x, y, 18);
          this.flash.fillStyle(0xfff4cb, 0.95).fillCircle(x, y, 4);
        }
      }
    }
  }
  const scene = new CourtyardScene({ key: "courtyard" });
  function reconcile(current: CourtyardScene) {
    if (!ready) return;
    if (previousLive === model.live && previousFrame === model.playback) return;
    if (
      previousFrame?.sequence !== model.playback?.sequence ||
      previousFrame?.animate !== model.playback?.animate
    )
      started = Date.now();
    if (previousLive && previousLive.id !== model.live.id) {
      for (const unit of units.values()) unit.container.destroy();
      units.clear();
    }
    previousLive = model.live;
    previousFrame = model.playback;
    for (const object of scenery) object.destroy();
    scenery.length = 0;
    for (const [id, unit] of units)
      if (!model.live.state.combatants[id]) {
        unit.container.destroy();
        units.delete(id);
      }
    for (const status of coverStatuses(arena, model.live.cover)) {
      const r = status.piece.rect;
      const p = project({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
      const left = project({ x: r.x, y: r.y });
      const right = project({ x: r.x + r.width, y: r.y + r.height });
      const width = (right.x - left.x) / 0.846;
      const front = project({ x: r.x + r.width, y: r.y });
      const prop = current.add
        .image(p.x, front.y, "crate")
        .setOrigin(0.5, 0.908)
        .setDisplaySize(width, status.destroyed ? width * 0.16 : width)
        .setDepth(p.y);
      prop.setData("destroyed", status.destroyed);
      if (status.destroyed) prop.setTint(0x4b535a).setAlpha(0.7);
      scenery.push(prop);
    }
    for (const id of model.live.state.order) {
      const actor = model.live.state.combatants[id];
      const data = model.live.data[id];
      if (!actor || !data) continue;
      if (units.has(id)) continue;
      const p = project(data.position);
      const shadow = current.add.ellipse(0, 0, 30, 12, 0x01050a, 0.6);
      const sprite = current.add
        .image(0, 0, actor.isPlayer ? "mercenary" : "hostile", 0)
        .setOrigin(0.5, CHARACTER_FRAME.foot / CHARACTER_FRAME.size);
      const container = current.add.container(p.x, p.y, [shadow, sprite]).setDepth(p.y);
      const other = model.live.state.order.find((otherId) => {
        const otherActor = model.live.state.combatants[otherId];
        return otherActor && !otherActor.defeated && otherActor.side !== actor.side;
      });
      const toward = other ? model.live.data[other]?.position : null;
      units.set(id, {
        container,
        sprite,
        shadow,
        facing: toward
          ? facingFor(p, project(toward), actor.isPlayer ? "ne" : "sw")
          : actor.isPlayer
            ? "ne"
            : "sw",
      });
    }
  }
  function resize() {
    if (disposed || !ready || !host.clientWidth || !host.clientHeight) return;
    if (game.scale.width !== host.clientWidth || game.scale.height !== host.clientHeight)
      game.scale.resize(host.clientWidth, host.clientHeight);
    const camera = courtyardCamera(host.clientWidth, host.clientHeight, model.camera);
    scene.cameras.main.setZoom(camera.zoom).centerOn(camera.x, camera.y);
  }
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: host,
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
    backgroundColor: "#050b10",
    transparent: false,
    banner: false,
    audio: { noAudio: true },
    input: { mouse: false, touch: false, keyboard: false, gamepad: false },
    fps: { target: 60 },
    scene,
  });
  const lost = () => {
    ready = false;
    onFailure();
  };
  game.canvas.addEventListener("webglcontextlost", lost);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  return {
    sync(next) {
      model = next;
      reconcile(scene);
      resize();
    },
    destroy() {
      disposed = true;
      observer.disconnect();
      game.canvas.removeEventListener("webglcontextlost", lost);
      game.destroy(true);
    },
  };
}
