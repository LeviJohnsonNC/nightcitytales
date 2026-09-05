import Phaser from "phaser";
import { arenaFor, coverStatuses } from "@/engine";
import type { LiveEncounter } from "@/features/campaign/encounterState";
import { battlefieldProjection } from "../battlefieldProjection";
import { frameDuration, type PlaybackFrame } from "../combatPlayback";
import { courtyardCamera, routePosition } from "./courtyardPresentation";

export type CourtyardModel = {
  live: LiveEncounter;
  playback?: PlaybackFrame | null | undefined;
  camera: { x: number; y: number; zoom: number };
};
export type CourtyardRenderer = { sync: (model: CourtyardModel) => void; destroy: () => void };

// Generated proof assets use a light matte. Key only the edge-connected matte
// when uploading textures; bright detail enclosed by the character is preserved.
// Production animation sheets should supply authored alpha instead.
function clearMatte(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const pixels = ctx.getImageData(0, 0, width, height);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0,
    tail = 0;
  const add = (index: number) => {
    if (index < 0 || index >= visited.length || visited[index]) return;
    visited[index] = 1;
    const offset = index * 4;
    if (Math.min(pixels.data[offset]!, pixels.data[offset + 1]!, pixels.data[offset + 2]!) < 205)
      return;
    queue[tail++] = index;
  };
  for (let x = 0; x < width; x++) {
    add(x);
    add((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    add(y * width);
    add(y * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head++]!;
    pixels.data[index * 4 + 3] = 0;
    if (index % width) add(index - 1);
    if (index % width < width - 1) add(index + 1);
    add(index - width);
    add(index + width);
  }
  ctx.putImageData(pixels, 0, 0);
}

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
  const units = new Map<string, Phaser.GameObjects.Container>();
  const scenery: Phaser.GameObjects.Image[] = [];

  class CourtyardScene extends Phaser.Scene {
    weather!: Phaser.GameObjects.Graphics;
    flash!: Phaser.GameObjects.Graphics;
    preload() {
      for (const key of ["ground", "crate", "mercenary", "hostile"])
        this.load.image(`source-${key}`, `/images/combat/night-shift/${key}.png`);
      this.load.on("loaderror", onFailure);
    }
    create() {
      if (disposed) return;
      if (
        ["ground", "crate", "mercenary", "hostile"].some(
          (key) => !this.textures.exists(`source-${key}`),
        )
      ) {
        onFailure();
        return;
      }
      for (const key of ["crate", "mercenary", "hostile"]) {
        const source = this.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement;
        const width = key === "crate" ? 256 : 192;
        const height = Math.round((width * source.height) / source.width);
        const texture = this.textures.createCanvas(key, width, height)!;
        const ctx = texture.context;
        ctx.drawImage(source, 0, 0, width, height);
        clearMatte(ctx, width, height);
        texture.refresh();
        this.textures.remove(`source-${key}`);
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
      if (
        frame?.kind === "move" &&
        frame.actorId &&
        frame.path &&
        frame.animate !== false &&
        !motion.matches
      ) {
        const progress = Math.min(1, Math.max(0, (this.time.now - started) / frameDuration(frame)));
        const point = routePosition(frame.path, progress);
        const unit = units.get(frame.actorId);
        if (point && unit) {
          const p = project(point);
          unit.setPosition(p.x, p.y).setDepth(p.y);
        }
      }
      for (const prop of scenery) {
        if (prop.getData("destroyed")) continue;
        const obstructs = [...units.values()].some(
          (unit) =>
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
        frame.animate !== false &&
        !motion.matches &&
        this.time.now - started < 110 &&
        frame.actorId
      ) {
        const position = model.live.data[frame.actorId]?.position;
        if (position) {
          const p = project(position);
          const muzzleX = p.x + (model.live.state.combatants[frame.actorId]?.isPlayer ? 16 : -16);
          this.flash.fillStyle(0xffd599, 0.24).fillCircle(muzzleX, p.y - 35, 22);
          this.flash.fillStyle(0xfff4cb, 0.95).fillCircle(muzzleX, p.y - 35, 5);
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
      started = current.time.now;
    previousLive = model.live;
    previousFrame = model.playback;
    for (const object of scenery) object.destroy();
    scenery.length = 0;
    for (const unit of units.values()) unit.destroy();
    units.clear();
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
      const p = project(data.position);
      const shadow = current.add.ellipse(0, 0, 30, 12, 0x01050a, 0.6);
      const sprite = current.add
        .image(0, 0, actor.isPlayer ? "mercenary" : "hostile")
        .setOrigin(0.5, 0.965)
        .setDisplaySize(56, 84);
      if (actor.defeated)
        sprite
          .setAngle(78)
          .setScale(sprite.scaleX * 0.8, sprite.scaleY * 0.8)
          .setAlpha(0.5)
          .setY(-7);
      const unit = current.add.container(p.x, p.y, [shadow, sprite]).setDepth(p.y);
      units.set(id, unit);
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
