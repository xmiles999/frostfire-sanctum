import {
  Application,
  Assets,
  Cache,
  Container,
  Graphics,
  Sprite,
  Text,
  Texture,
  TilingSprite,
} from "pixi.js";
import {
  DOOR_LATCH_MS,
  DOOR_MOTION_MS,
  PLATE_HOLD_MS,
  TILE,
} from "../engine/constants";
import { makeCamera, updateCamera, type Camera } from "../engine/camera";
import { rectsOverlap, type Rect } from "../engine/aabb";
import { actorRect } from "../engine/physics";
import type { ActorState, CrateState, Hazard, LeverSpec, SimState } from "../sim/types";
import { activeHazards, standingOnPlate } from "../sim/world";

const BASE = import.meta.env.BASE_URL.replace(/\/?$/, "/");

function asset(path: string): string {
  return `${BASE}${path.replace(/^\//, "")}`;
}

function frameUrls(dir: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => asset(`${dir}/${String(i).padStart(2, "0")}.png`));
}

/** On-screen character height in world px. Collision is 70; keep a little cape/hair overshoot. */
const SPRITE_H = 96;

function criticalUrls(): string[] {
  return [
    asset("assets/characters/ember/idle/00.png"),
    asset("assets/characters/frost/idle/00.png"),
    asset("assets/levels/01/bg-far.jpg"),
    asset("assets/levels/01/bg-mid.jpg"),
    asset("assets/levels/01/lava-channel.jpg"),
    asset("assets/levels/01/water-channel.jpg"),
    asset("assets/levels/01/lava-surface.jpg"),
    asset("assets/levels/01/water-surface.jpg"),
    asset("assets/levels/01/road-ember.jpg"),
    asset("assets/levels/01/road-frost.jpg"),
    asset("assets/levels/01/wall.jpg"),
    asset("assets/levels/01/ceiling.jpg"),
    asset("assets/levels/01/door.png"),
    asset("assets/levels/01/altar.png"),
    asset("assets/ui/pressure-plate.png"),
    asset("assets/fx/wisp.png"),
  ];
}

function restUrls(): string[] {
  return [
    ...frameUrls("assets/characters/ember/idle", 8).slice(1),
    ...frameUrls("assets/characters/ember/walk", 12),
    ...frameUrls("assets/characters/ember/jump", 6),
    asset("assets/characters/ember/downed/00.png"),
    ...frameUrls("assets/characters/frost/idle", 8).slice(1),
    ...frameUrls("assets/characters/frost/walk", 12),
    ...frameUrls("assets/characters/frost/jump", 6),
    asset("assets/characters/frost/downed/00.png"),
  ];
}

export class GameView {
  readonly app: Application;
  private world = new Container();
  private props = new Container();
  private far!: Sprite;
  private mid!: Sprite;
  private overlay = new Graphics();
  private mechanismFx = new Graphics();
  private steamFx = new Graphics();
  private ember!: Sprite;
  private frost!: Sprite;
  private wisp!: Sprite;
  private plateEmber!: Sprite;
  private plateFrost!: Sprite;
  private altar!: Sprite;
  private doorSprites: Sprite[] = [];
  private worldSigns = new Map<string, Text>();
  private liquids: {
    kind: "lava" | "water";
    rect: Rect;
    body: TilingSprite;
    surface: TilingSprite;
  }[] = [];
  private frames!: {
    ember: Record<string, Texture[]>;
    frost: Record<string, Texture[]>;
  };
  cam: Camera;
  private parent: HTMLElement;

  constructor(app: Application, parent: HTMLElement) {
    this.app = app;
    this.parent = parent;
    this.cam = makeCamera(Math.max(parent.clientWidth, 640), Math.max(parent.clientHeight, 360));
  }

  static async create(
    canvas: HTMLCanvasElement,
    parent: HTMLElement,
    signal?: AbortSignal,
  ): Promise<GameView> {
    await Assets.load(criticalUrls());
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");

    const rect = parent.getBoundingClientRect();
    const width = Math.max(Math.floor(rect.width) || window.innerWidth || 1280, 640);
    const height = Math.max(Math.floor(rect.height) || window.innerHeight || 720, 360);

    const app = new Application();
    await app.init({
      canvas,
      background: "#1a140f",
      antialias: true,
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      width,
      height,
      resizeTo: parent,
    });
    if (signal?.aborted) {
      app.destroy({ removeView: false });
      throw new DOMException("aborted", "AbortError");
    }
    const view = new GameView(app, parent);
    view.build();
    void Assets.load(restUrls()).then(() => {
      if (signal?.aborted) return;
      view.hydrate();
    });
    return view;
  }

  private tex(path: string): Texture {
    const url = asset(path);
    return Cache.has(url) ? (Cache.get(url) as Texture) : Texture.from(url);
  }

  private seq(dir: string, count: number, fallback: Texture): Texture[] {
    return frameUrls(dir, count).map((url) =>
      Cache.has(url) ? (Cache.get(url) as Texture) : fallback,
    );
  }

  private tile(tex: Texture, r: Rect): TilingSprite {
    const t = new TilingSprite({ texture: tex, width: Math.max(r.w, 1), height: Math.max(r.h, 1) });
    t.x = r.x;
    t.y = r.y;
    const ts = Math.max(0.25, Math.min(1.2, r.h / Math.max(tex.height, 1)));
    t.tileScale.set(ts);
    return t;
  }

  private slab(tex: Texture, r: Rect, extraTop = 28, extraBottom = 8): TilingSprite {
    const h = Math.max(r.h + extraTop + extraBottom, 8);
    const t = new TilingSprite({ texture: tex, width: Math.max(r.w, 1), height: h });
    t.x = r.x;
    t.y = r.y - extraTop;
    const ts = h / Math.max(tex.height, 1);
    t.tileScale.set(ts);
    return t;
  }

  private solidKind(r: Rect, worldH: number): "ember" | "frost" | "ceiling" | "wall" {
    if (r.h >= r.w * 1.5) return "wall";
    if (r.y <= TILE * 0.6) return "ceiling";
    if (r.y >= worldH - 6 * TILE) return "frost";
    return "ember";
  }

  private channel(tex: Texture, r: Rect, extraTop: number, extraBottom: number): TilingSprite {
    const h = Math.max(r.h + extraTop + extraBottom, 8);
    const t = new TilingSprite({ texture: tex, width: Math.max(r.w, 1), height: h });
    t.x = r.x;
    t.y = r.y - extraTop;
    t.tileScale.set(h / Math.max(tex.height, 1));
    return t;
  }

  private liquidPad(kind: "lava" | "water"): { extraTop: number; extraBottom: number } {
    return kind === "lava" ? { extraTop: 20, extraBottom: 28 } : { extraTop: 16, extraBottom: 42 };
  }

  private sit(tex: Texture, r: Rect, height: number): Sprite {
    const s = new Sprite(tex);
    s.anchor.set(0.5, 1);
    s.x = r.x + r.w / 2;
    s.y = r.y + r.h;
    const sc = height / Math.max(tex.height, 1);
    s.scale.set(sc);
    return s;
  }

  private build(): void {
    const emberIdle0 = this.tex("assets/characters/ember/idle/00.png");
    const frostIdle0 = this.tex("assets/characters/frost/idle/00.png");
    this.frames = {
      ember: {
        idle: this.seq("assets/characters/ember/idle", 8, emberIdle0),
        walk: this.seq("assets/characters/ember/walk", 12, emberIdle0),
        jump: this.seq("assets/characters/ember/jump", 6, emberIdle0),
        fall: this.seq("assets/characters/ember/jump", 6, emberIdle0),
        downed: [emberIdle0],
      },
      frost: {
        idle: this.seq("assets/characters/frost/idle", 8, frostIdle0),
        walk: this.seq("assets/characters/frost/walk", 12, frostIdle0),
        jump: this.seq("assets/characters/frost/jump", 6, frostIdle0),
        fall: this.seq("assets/characters/frost/jump", 6, frostIdle0),
        downed: [frostIdle0],
      },
    };

    this.far = new Sprite(this.tex("assets/levels/01/bg-far.jpg"));
    this.mid = new Sprite(this.tex("assets/levels/01/bg-mid.jpg"));
    this.mid.alpha = 0.52;
    this.ember = new Sprite(this.frames.ember.idle[0]);
    this.frost = new Sprite(this.frames.frost.idle[0]);
    this.wisp = new Sprite(this.tex("assets/fx/wisp.png"));
    this.plateEmber = this.sit(this.tex("assets/ui/pressure-plate.png"), { x: 0, y: 0, w: 1, h: 1 }, 44);
    this.plateFrost = this.sit(this.tex("assets/ui/pressure-plate.png"), { x: 0, y: 0, w: 1, h: 1 }, 44);
    this.altar = this.sit(this.tex("assets/levels/01/altar.png"), { x: 0, y: 0, w: 1, h: 1 }, 96);

    for (const s of [this.ember, this.frost, this.wisp]) s.anchor.set(0.5, 1);

    this.app.stage.addChild(this.far, this.mid, this.world);
    this.world.addChild(
      this.props,
      this.mechanismFx,
      this.steamFx,
      this.overlay,
      this.frost,
      this.ember,
      this.wisp,
    );
  }

  hydrate(): void {
    const emberIdle0 = this.tex("assets/characters/ember/idle/00.png");
    const frostIdle0 = this.tex("assets/characters/frost/idle/00.png");
    this.frames.ember.idle = this.seq("assets/characters/ember/idle", 8, emberIdle0);
    this.frames.ember.walk = this.seq("assets/characters/ember/walk", 12, emberIdle0);
    this.frames.ember.jump = this.seq("assets/characters/ember/jump", 6, emberIdle0);
    this.frames.ember.fall = this.frames.ember.jump;
    this.frames.ember.downed = [this.tex("assets/characters/ember/downed/00.png")];
    this.frames.frost.idle = this.seq("assets/characters/frost/idle", 8, frostIdle0);
    this.frames.frost.walk = this.seq("assets/characters/frost/walk", 12, frostIdle0);
    this.frames.frost.jump = this.seq("assets/characters/frost/jump", 6, frostIdle0);
    this.frames.frost.fall = this.frames.frost.jump;
    this.frames.frost.downed = [this.tex("assets/characters/frost/downed/00.png")];
  }

  destroy(): void {
    try {
      this.app.destroy({ removeView: false }, { children: true });
    } catch {
      /* already destroyed */
    }
  }

  resetWorld(): void {
    this.props.removeChildren();
    this.liquids = [];
    this.doorSprites = [];
  }

  private layoutProps(sim: SimState): void {
    if (this.props.children.length > 0) return;
    const roadEmber = this.tex("assets/levels/01/road-ember.jpg");
    const roadFrost = this.tex("assets/levels/01/road-frost.jpg");
    const wall = this.tex("assets/levels/01/wall.jpg");
    const ceiling = this.tex("assets/levels/01/ceiling.jpg");
    const lavaChannel = this.tex("assets/levels/01/lava-channel.jpg");
    const waterChannel = this.tex("assets/levels/01/water-channel.jpg");
    const lavaSurface = this.tex("assets/levels/01/lava-surface.jpg");
    const waterSurface = this.tex("assets/levels/01/water-surface.jpg");
    const doorTex = this.tex("assets/levels/01/door.png");

    const worldH = sim.level.size.h * TILE;
    for (const s of sim.level.solids) {
      const kind = this.solidKind(s, worldH);
      if (kind === "wall") this.props.addChild(this.tile(wall, s));
      else if (kind === "ceiling") this.props.addChild(this.slab(ceiling, s, 0, 18));
      else if (kind === "frost") this.props.addChild(this.slab(roadFrost, s));
      else this.props.addChild(this.slab(roadEmber, s));
    }
    this.liquids = [];
    for (const h of sim.level.hazards) {
      const kind = h.type === "lava_shallow" ? "lava" : h.type === "water_shallow" ? "water" : null;
      if (!kind) continue;
      const pad = this.liquidPad(kind);
      const body = this.channel(
        kind === "lava" ? lavaChannel : waterChannel,
        h.rect,
        pad.extraTop,
        pad.extraBottom,
      );
      const surfaceH = pad.extraTop + Math.min(18, h.rect.h * 0.5);
      const surfaceTex = kind === "lava" ? lavaSurface : waterSurface;
      const surface = new TilingSprite({
        texture: surfaceTex,
        width: Math.max(h.rect.w, 1),
        height: surfaceH,
      });
      surface.x = h.rect.x;
      surface.y = h.rect.y - pad.extraTop + 3;
      surface.alpha = kind === "lava" ? 0.58 : 0.46;
      const sts = (surfaceH / Math.max(surfaceTex.height, 1)) * 1.15;
      surface.tileScale.set(sts);
      this.props.addChild(body, surface);
      this.liquids.push({ kind, rect: h.rect, body, surface });
    }
    this.doorSprites = sim.level.gatedSolids.map((s) => {
      const d = new Sprite(doorTex);
      d.anchor.set(0.5, 1);
      d.x = s.x + s.w / 2;
      d.y = s.y + s.h;
      d.scale.set(Math.max(s.w * 2.4, 56) / doorTex.width, s.h / doorTex.height);
      this.props.addChild(d);
      return d;
    });
    this.props.addChild(this.plateEmber, this.plateFrost, this.altar);

    for (const x of [10.5, 25, 38, 49, 62]) {
      const col = this.tile(wall, { x: x * TILE, y: 9 * TILE, w: 22, h: 6 * TILE });
      col.alpha = 0.42;
      this.props.addChild(col);
    }
  }

  render(sim: SimState, dt: number): void {
    const cssW = this.parent.clientWidth || window.innerWidth || 1280;
    const cssH = this.parent.clientHeight || window.innerHeight || 720;
    this.cam.w = Math.max(cssW, 640);
    this.cam.h = Math.max(cssH, 360);
    updateCamera(this.cam, sim, dt);
    this.layoutProps(sim);

    this.far.width = this.cam.w;
    this.far.height = this.cam.h;
    this.far.x = 0;
    this.far.y = 0;
    this.mid.width = this.cam.w * 1.28;
    this.mid.height = this.cam.h * 0.94;
    this.mid.x = -this.cam.x * 0.14;
    this.mid.y = this.cam.h * 0.08 - this.cam.y * 0.05;

    this.world.x = -this.cam.x;
    this.world.y = -this.cam.y;

    this.plateEmber.x = sim.level.plates.ember.x + sim.level.plates.ember.w / 2;
    this.plateEmber.y = sim.level.plates.ember.y + sim.level.plates.ember.h;
    this.plateEmber.tint = sim.plateEmber ? 0xffe0a0 : 0xffffff;
    this.plateFrost.x = sim.level.plates.frost.x + sim.level.plates.frost.w / 2;
    this.plateFrost.y = sim.level.plates.frost.y + sim.level.plates.frost.h;
    this.plateFrost.tint = sim.plateFrost ? 0xb8eeff : 0xffffff;
    this.altar.x = sim.level.altar.x + sim.level.altar.w / 2;
    this.altar.y = sim.level.altar.y + sim.level.altar.h;

    const doorProgress = this.doorProgress(sim);
    for (const [index, d] of this.doorSprites.entries()) {
      const gate = sim.level.gatedSolids[index];
      if (!gate) continue;
      const direction = index === 0 ? -1 : 1;
      d.visible = true;
      d.x = gate.x + gate.w / 2;
      d.y = gate.y + gate.h + direction * gate.h * 0.92 * doorProgress;
      d.alpha = 1 - doorProgress * 0.18;
    }

    this.flowLiquids(dt);
    this.paintSteam(sim);
    this.paintMechanisms(sim, doorProgress);
    this.paintPuzzles(sim);
    this.syncWorldSigns(sim);
    this.paintMarks(sim);
    this.wisp.visible = sim.wisp.nestX > 0;
    this.pose(this.ember, sim.ember, "ember");
    this.pose(this.frost, sim.frost, "frost");
    this.wisp.x = sim.wisp.x;
    this.wisp.y = sim.wisp.y + 22;
    const wispS = 52 / Math.max(this.wisp.texture.height, 1);
    this.wisp.scale.set(wispS * sim.wisp.facing, wispS);
    this.wisp.alpha = sim.wisp.phase === "idle" ? 0.85 : 1;
    this.wisp.tint = sim.wisp.phase === "acquire" ? 0xffdd88 : 0xffffff;
    this.app.render();
  }

  private pose(sprite: Sprite, actor: ActorState, who: "ember" | "frost"): void {
    const set = this.frames[who];
    const key =
      actor.anim === "fall" || actor.anim === "land"
        ? actor.anim === "land"
          ? "idle"
          : "jump"
        : actor.anim === "interact"
          ? "idle"
          : actor.anim;
    const frames = set[key] ?? set.idle;
    const fps = actor.anim === "walk" ? 14 : actor.anim === "idle" ? 8 : 10;
    const idx = Math.floor(actor.animTime * fps) % frames.length;
    sprite.texture = frames[idx]!;
    sprite.x = actor.x + actor.w / 2;
    sprite.y = actor.y + actor.h;
    const s = SPRITE_H / Math.max(sprite.texture.height, 1);
    const landT = Math.max(0, Math.min(1, actor.landMs / 120));
    const squash = actor.onGround ? landT * 0.1 : 0;
    const stretch = !actor.onGround && actor.vy < -180 ? 0.035 : 0;
    sprite.scale.set(s * actor.facing * (1 + squash - stretch), s * (1 - squash + stretch));
    sprite.rotation = actor.onGround ? 0 : Math.max(-0.08, Math.min(0.08, actor.vx / 4200));
    sprite.alpha = actor.invulnMs > 0 ? 0.7 : 1;
  }

  private flowLiquids(dt: number): void {
    for (const liquid of this.liquids) {
      const flow = liquid.kind === "lava" ? 22 : 36;
      liquid.surface.tilePosition.x += dt * flow;
      liquid.body.tilePosition.x += dt * flow * 0.12;
    }
  }

  private paintSteam(sim: SimState): void {
    const g = this.steamFx;
    g.clear();
    for (const h of sim.level.hazards) {
      if (h.type !== "steam_hot") continue;
      const phase = sim.steamPhase;
      const bottom = h.rect.y + h.rect.h - 10;
      const safe = phase === "safe";
      const telegraph = phase === "telegraph";
      const cloudCount = safe ? 4 : telegraph ? 9 : 24;
      const travel = safe ? 58 : telegraph ? 88 : h.rect.h + 70;
      const speed = safe ? 0.025 : telegraph ? 0.07 : 0.16;

      if (!safe) {
        const coreAlpha = telegraph ? 0.15 : 0.34;
        g.roundRect(h.rect.x + h.rect.w * 0.18, h.rect.y, h.rect.w * 0.64, h.rect.h, 22);
        g.fill({ color: 0xf8fbff, alpha: coreAlpha });
      }

      for (let i = 0; i < cloudCount; i++) {
        const phaseOffset = i * (travel / cloudCount);
        const rise = (sim.timeMs * speed + phaseOffset) % travel;
        const normalized = rise / travel;
        const sway = Math.sin(sim.timeMs * 0.006 + i * 1.73) * (8 + normalized * 13);
        const lane = ((i * 37) % Math.max(20, h.rect.w - 20)) + 10;
        const px = h.rect.x + lane + sway;
        const py = bottom - rise;
        const radius = (safe ? 4 : telegraph ? 5 : 8) + (i % 4) * 2 + normalized * 8;
        const alpha = safe
          ? 0.08 * (1 - normalized)
          : telegraph
            ? 0.24 * (1 - normalized * 0.65)
            : 0.48 * (1 - normalized * 0.52);
        g.circle(px, py, radius);
        g.fill({ color: i % 3 === 0 ? 0xd8e8ee : 0xf7f4ea, alpha });
      }

      if (telegraph) {
        const pulse = 0.45 + Math.sin(sim.timeMs * 0.045) * 0.18;
        for (let i = 0; i < 5; i++) {
          const px = h.rect.x + 10 + ((i * 23 + sim.timeMs * 0.09) % (h.rect.w - 20));
          const py = bottom - 4 - ((sim.timeMs * 0.08 + i * 9) % 28);
          g.circle(px, py, 2 + (i % 2));
          g.fill({ color: 0xffffff, alpha: pulse });
        }
      } else if (phase === "lethal") {
        const blastAlpha = 0.2 + Math.sin(sim.timeMs * 0.022) * 0.05;
        g.roundRect(h.rect.x + h.rect.w * 0.31, bottom - h.rect.h, h.rect.w * 0.38, h.rect.h, 18);
        g.fill({ color: 0xffffff, alpha: blastAlpha });
      }
    }
  }

  private doorProgress(sim: SimState): number {
    if (sim.doorPhase === "open") return 1;
    if (sim.doorPhase === "opening") {
      return 1 - Math.max(0, Math.min(1, sim.doorMotionMs / DOOR_MOTION_MS));
    }
    if (sim.doorPhase === "closing") {
      return Math.max(0, Math.min(1, sim.doorMotionMs / DOOR_MOTION_MS));
    }
    return 0;
  }

  private paintMechanisms(sim: SimState, doorProgress: number): void {
    const g = this.mechanismFx;
    g.clear();

    for (const h of sim.level.hazards) {
      if (h.type !== "steam_hot") continue;
      const telegraph = sim.steamPhase === "telegraph";
      const lethal = sim.steamPhase === "lethal";
      const shake = telegraph
        ? Math.sin(sim.timeMs * 0.12) * 4
        : lethal
          ? Math.sin(sim.timeMs * 0.045) * 1.2
          : 0;
      const cx = h.rect.x + h.rect.w / 2 + shake;
      const y = h.rect.y + h.rect.h - 13;
      const lidW = h.rect.w + 26;
      const lidX = cx - lidW / 2;
      const seamAlpha = telegraph ? 0.75 + Math.sin(sim.timeMs * 0.05) * 0.2 : lethal ? 0.9 : 0.32;

      g.roundRect(lidX - 4, y + 7, lidW + 8, 14, 5);
      g.fill({ color: 0x181a1c, alpha: 0.92 });
      g.stroke({ color: 0x675f55, width: 2, alpha: 0.9 });
      g.roundRect(lidX, y, lidW, 14, 7);
      g.fill({ color: telegraph ? 0x665b4e : 0x3f4448, alpha: 1 });
      g.stroke({ color: lethal ? 0xffc78a : 0x9aa2a5, width: 2, alpha: 0.95 });
      g.roundRect(lidX + 12, y + 5, lidW - 24, 3, 2);
      g.fill({ color: lethal ? 0xfff2d7 : telegraph ? 0xffd39c : 0xa8c4c9, alpha: seamAlpha });
      for (const bx of [lidX + 10, lidX + lidW - 10]) {
        g.circle(bx, y + 7, 3.5);
        g.fill({ color: 0x191b1d, alpha: 1 });
        g.stroke({ color: 0xb0a89c, width: 1, alpha: 0.8 });
      }
    }

    const platePairs = [
      { rect: sim.level.plates.ember, active: sim.plateEmber, color: 0xffa45f, start: Math.PI },
      { rect: sim.level.plates.frost, active: sim.plateFrost, color: 0x8edfff, start: 0 },
    ];
    const holdT = Math.min(1, sim.bothHeldMs / PLATE_HOLD_MS);
    for (const plate of platePairs) {
      const cx = plate.rect.x + plate.rect.w / 2;
      const cy = plate.rect.y + 2;
      const radius = Math.min(34, plate.rect.w * 0.24);
      g.arc(cx, cy, radius, plate.start, plate.start + Math.PI);
      g.stroke({ color: 0x5b554c, width: 4, alpha: 0.75 });
      if (plate.active) {
        g.arc(cx, cy, radius, plate.start, plate.start + Math.PI);
        g.stroke({ color: plate.color, width: 5, alpha: 0.95 });
        if (sim.plateEmber && sim.plateFrost) {
          g.arc(cx, cy, radius, plate.start + Math.PI, plate.start + Math.PI * (1 + holdT));
          g.stroke({ color: plate.color, width: 5, alpha: 0.95 });
        }
      }
      if (sim.doorOpen) {
        g.circle(cx, cy, radius + 7 + Math.sin(sim.timeMs * 0.012) * 2);
        g.stroke({ color: plate.color, width: 2, alpha: 0.28 });
      }
    }

    for (const [index, gate] of sim.level.gatedSolids.entries()) {
      const cx = gate.x + gate.w / 2;
      const cy = index === 0 ? gate.y + gate.h - 48 : gate.y + 48;
      const latchT = sim.doorOpen ? Math.max(0, Math.min(1, sim.latchMs / DOOR_LATCH_MS)) : 0;
      const color = sim.doorOpen ? (latchT < 0.25 ? 0xff8a5c : 0xe8be68) : 0x71654e;
      g.circle(cx, cy, 22);
      g.fill({ color: 0x111214, alpha: 0.76 });
      g.stroke({ color: 0x6f675b, width: 4, alpha: 0.9 });
      if (sim.doorOpen) {
        g.arc(cx, cy, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * latchT);
        g.stroke({ color, width: 5, alpha: 1 });
      }
      g.roundRect(cx - 6, cy - 8 + doorProgress * 4, 12, 16 - doorProgress * 7, 3);
      g.fill({ color, alpha: 0.9 });
    }

    for (const [plate, active] of [
      [this.plateEmber, sim.plateEmber],
      [this.plateFrost, sim.plateFrost],
    ] as const) {
      const plateScale = 44 / Math.max(plate.texture.height, 1);
      plate.scale.set(plateScale, plateScale * (active ? 0.72 : 1));
      plate.y += active ? 6 : 0;
    }
  }

  private paintMarks(sim: SimState): void {
    const g = this.overlay;
    g.clear();
    const pe = sim.level.plates.ember;
    const pf = sim.level.plates.frost;
    if (sim.bothHeldMs > 0 && !sim.doorOpen) {
      const t = Math.min(1, sim.bothHeldMs / 800);
      g.roundRect(pe.x, pe.y - 14, pe.w * t, 6, 2);
      g.fill({ color: 0xffdd88 });
      g.roundRect(pf.x, pf.y - 14, pf.w * t, 6, 2);
      g.fill({ color: 0xaaddff });
    }
    this.paintLiquids(sim);

    for (const h of sim.level.hazards) {
      if (h.type !== "ice_mist") continue;
      const pulse = 0.14 + Math.sin(sim.timeMs * 0.005) * 0.05;
      g.roundRect(h.rect.x, h.rect.y, h.rect.w, h.rect.h, 12);
      g.fill({ color: 0xc8e7f4, alpha: pulse });
      for (let i = 0; i < 6; i++) {
        const px = h.rect.x + 8 + ((i * 41 + sim.timeMs * 0.03) % Math.max(12, h.rect.w - 16));
        const py = h.rect.y + 10 + ((sim.timeMs * 0.04 + i * 17) % Math.max(12, h.rect.h - 20));
        g.circle(px, py, 3 + (i % 3));
        g.fill({ color: 0xeef8ff, alpha: 0.18 });
      }
    }

    g.roundRect(sim.level.exits.ember.x, sim.level.exits.ember.y, sim.level.exits.ember.w, sim.level.exits.ember.h, 8);
    g.fill({ color: 0xff6a1a, alpha: 0.22 });
    g.stroke({ color: 0xffb070, width: 3, alpha: 0.95 });
    g.roundRect(sim.level.exits.frost.x, sim.level.exits.frost.y, sim.level.exits.frost.w, sim.level.exits.frost.h, 8);
    g.fill({ color: 0x3aa0c8, alpha: 0.22 });
    g.stroke({ color: 0x9be7ff, width: 3, alpha: 0.95 });

    for (const a of [sim.ember, sim.frost]) {
      if (a.landMs > 0) {
        const t = 1 - Math.max(0, Math.min(1, a.landMs / 120));
        const radius = 8 + t * 24;
        g.ellipse(a.x + a.w / 2, a.y + a.h - 2, radius, 5 + t * 3);
        g.stroke({
          color: a.id === "ember" ? 0xf0b47a : 0xa9ddec,
          width: 2,
          alpha: (1 - t) * 0.45,
        });
      }
      if (!a.onGround || Math.abs(a.vx) < 30) continue;
      const lava = sim.level.hazards.some((h) => h.type === "lava_shallow" && rectsOverlap(actorRect(a), h.rect));
      const water = sim.level.hazards.some((h) => h.type === "water_shallow" && rectsOverlap(actorRect(a), h.rect));
      const footX = a.x + a.w / 2;
      const footY = a.y + a.h;
      if (lava) {
        g.ellipse(footX, footY - 2, 11, 5);
        g.fill({ color: 0xffc266, alpha: 0.38 });
        g.circle(footX + 4, footY - 10, 3.5);
        g.fill({ color: 0xffe29a, alpha: 0.45 });
      } else if (water) {
        g.ellipse(footX, footY - 1, 14, 4);
        g.stroke({ color: 0xc5eef8, width: 2, alpha: 0.42 });
      } else {
        g.circle(footX, footY, 7);
        g.fill({ color: 0xc2b8a3, alpha: 0.28 });
      }
    }
  }

  private paintLiquids(sim: SimState): void {
    const g = this.overlay;
    for (const h of activeHazards(sim)) {
      if (h.type === "lava_shallow" || h.type === "lava_deep") this.paintLavaFx(g, h, sim.timeMs);
      if (h.type === "water_shallow" || h.type === "water_deep") this.paintRiverFx(g, h, sim.timeMs);
    }
  }

  private paintLavaFx(g: Graphics, h: Hazard, timeMs: number): void {
    const r = h.rect;
    const pulse = 0.18 + Math.sin(timeMs * 0.006) * 0.07;
    g.roundRect(r.x - 2, r.y - 6, r.w + 4, 12, 4);
    g.fill({ color: 0xff6a1a, alpha: pulse });
    g.rect(r.x, r.y + 2, r.w, 3);
    g.fill({ color: 0xffdd88, alpha: 0.22 + Math.sin(timeMs * 0.01) * 0.06 });

    const count = Math.max(5, Math.floor(r.w / 58));
    for (let i = 0; i < count; i++) {
      const t = ((timeMs * 0.00032 + i * 0.19) % 1 + 1) % 1;
      const px = r.x + 10 + ((i * 73 + timeMs * 0.018) % Math.max(12, r.w - 20));
      const py = r.y + 6 - t * 26;
      const rad = 2 + (i % 3) + (1 - t) * 2;
      g.circle(px, py, rad);
      g.fill({ color: 0xffc266, alpha: 0.42 * (1 - t) });
      g.circle(px - 0.5, py - 0.5, rad * 0.4);
      g.fill({ color: 0xfff4d2, alpha: 0.55 * (1 - t) });
    }
  }

  private paintWell(sim: SimState, g: Graphics): void {
    const plate = sim.level.tide?.wellPlate;
    if (!plate) return;
    const crate = sim.crates[0];
    const seated =
      !!crate &&
      crate.onGround &&
      crate.x + crate.w / 2 >= plate.x &&
      crate.x + crate.w / 2 <= plate.x + plate.w &&
      sim.tideLevel === 2;
    const x = plate.x - 22;
    const w = plate.w + 44;
    const lipY = plate.y - 18;
    g.roundRect(x - 8, lipY + 14, w + 16, 28, 6);
    g.fill({ color: 0x2a2620, alpha: 0.55 });
    g.roundRect(x, lipY, w, 26, 10);
    g.fill({ color: 0x6a6054, alpha: 1 });
    g.stroke({ color: 0xe4d3b0, width: 3, alpha: 0.95 });
    g.roundRect(x + 12, lipY + 8, w - 24, 16, 8);
    g.fill({ color: 0x12161c, alpha: 0.96 });
    const waterH = sim.tideLevel === 0 ? 5 : sim.tideLevel === 1 ? 11 : 15;
    g.roundRect(x + 14, lipY + 22 - waterH, w - 28, waterH, 5);
    g.fill({ color: sim.tideLevel === 2 ? 0x163848 : 0x2f6d82, alpha: 0.88 });
    g.roundRect(x + 18, lipY + 22 - waterH, w - 36, 3, 2);
    g.fill({ color: 0xc5eaf4, alpha: 0.35 + Math.sin(sim.timeMs * 0.006) * 0.08 });
    g.roundRect(plate.x + 10, plate.y + 2, plate.w - 20, Math.max(8, plate.h - 2), 3);
    g.fill({ color: seated ? 0xf0d078 : 0x7a6238, alpha: 0.95 });
    if (seated) {
      g.roundRect(plate.x + 10, plate.y + 2, plate.w - 20, 8, 3);
      g.stroke({ color: 0xfff3c0, width: 2, alpha: 0.85 });
    }
    g.roundRect(x + 4, lipY - 78, 10, 78, 3);
    g.roundRect(x + w - 14, lipY - 78, 10, 78, 3);
    g.fill({ color: 0x5c5348, alpha: 1 });
    g.roundRect(x, lipY - 86, w, 12, 4);
    g.fill({ color: 0x7a7062, alpha: 1 });
    g.stroke({ color: 0xd9cbb0, width: 2, alpha: 0.8 });
    g.rect(x + w / 2 - 1.5, lipY - 74, 3, 48);
    g.fill({ color: 0x9a8868, alpha: 0.95 });
    g.circle(x + w / 2, lipY - 24, 7);
    g.fill({ color: 0x6a8ea0, alpha: 0.8 });
    g.stroke({ color: 0xd7eef4, width: 1.5, alpha: 0.7 });
  }

  private paintCrate(sim: SimState, g: Graphics, crate: CrateState): void {
    g.roundRect(crate.x, crate.y, crate.w, crate.h, 5);
    g.fill({ color: 0x8d6a3c, alpha: 1 });
    g.stroke({ color: 0xe6d2a8, width: 2, alpha: 0.95 });
    g.roundRect(crate.x + 5, crate.y + 6, crate.w - 10, 5, 2);
    g.roundRect(crate.x + 5, crate.y + crate.h - 11, crate.w - 10, 5, 2);
    g.fill({ color: 0x4d4538, alpha: 0.95 });
    g.rect(crate.x + crate.w / 2 - 3, crate.y + 4, 6, crate.h - 8);
    g.fill({ color: 0x3f3a32, alpha: 0.85 });
    if (sim.tideLevel > 0) {
      g.roundRect(crate.x + 6, crate.y + 8, crate.w - 12, 7, 2);
      g.fill({ color: 0x6aa0c8, alpha: 0.4 + sim.tideLevel * 0.18 });
    }
  }

  private paintLever(sim: SimState, g: Graphics, lever: LeverSpec): void {
    const r = lever.rect;
    const cx = r.x + r.w * 0.42;
    const baseY = r.y + r.h;
    g.roundRect(r.x - 10, baseY - 18, r.w + 28, 22, 6);
    g.fill({ color: 0x4a453c, alpha: 1 });
    g.stroke({ color: 0xd7c6a4, width: 2, alpha: 0.9 });
    g.roundRect(cx - 16, r.y - 8, 32, r.h + 10, 6);
    g.fill({ color: 0x2f2c28, alpha: 0.96 });
    const gaugeX = r.x + r.w + 8;
    const gaugeY = r.y - 36;
    g.roundRect(gaugeX, gaugeY, 16, 64, 4);
    g.fill({ color: 0x1c2228, alpha: 0.92 });
    g.stroke({ color: 0xb7c4c8, width: 1.5, alpha: 0.85 });
    const fillH = sim.tideLevel === 0 ? 14 : sim.tideLevel === 1 ? 34 : 54;
    if (lever.kind === "tide") {
      g.roundRect(gaugeX + 3, gaugeY + 60 - fillH, 10, fillH, 3);
      g.fill({ color: sim.tideLevel === 2 ? 0x1f5a72 : 0x4aa0b8, alpha: 0.95 });
      for (const [i, gy] of [gaugeY + 46, gaugeY + 26, gaugeY + 8].entries()) {
        g.rect(gaugeX - 5, gy, 5, 2);
        g.fill({ color: i === sim.tideLevel ? 0xffe08a : 0x8a8f92, alpha: 1 });
      }
    } else {
      g.roundRect(gaugeX + 3, gaugeY + 8, 10, sim.gearArmedMs !== null ? 48 : 10, 3);
      g.fill({ color: sim.gearArmedMs !== null ? 0xe08a3a : 0x6a645a, alpha: 0.95 });
    }
    const angle =
      lever.kind === "tide"
        ? sim.tideLevel === 0
          ? -1.15
          : sim.tideLevel === 2
            ? 1.05
            : 0.22
        : sim.gearArmedMs !== null
          ? 0.9
          : -0.95;
    const len = 62;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const nx = -s * 5;
    const ny = c * 5;
    const hx = cx + c * len;
    const hy = r.y + 10 + s * len;
    g.poly([cx + nx, r.y + 10 + ny, hx + nx, hy + ny, hx - nx, hy - ny, cx - nx, r.y + 10 - ny]);
    g.fill({ color: lever.kind === "tide" ? 0xc4a36a : 0xb0a898, alpha: 1 });
    g.stroke({ color: 0xf0e2c4, width: 1.5, alpha: 0.85 });
    g.circle(cx, r.y + 10, 7);
    g.fill({ color: 0x8a7a58, alpha: 1 });
    g.stroke({ color: 0xf2e6c8, width: 2, alpha: 0.9 });
    g.circle(hx, hy, 9);
    g.fill({ color: 0xe8dcc4, alpha: 1 });
    g.stroke({ color: 0x5a4030, width: 2, alpha: 0.85 });
    g.roundRect(cx - 36, r.y - 52, 72, 22, 4);
    g.fill({ color: 0x2a2218, alpha: 0.82 });
    g.stroke({ color: 0xe8d7a8, width: 1.5, alpha: 0.9 });
  }

  private worldSign(id: string, text: string): Text {
    let sign = this.worldSigns.get(id);
    if (!sign) {
      sign = new Text({
        text,
        style: {
          fontFamily: "Noto Sans SC, Source Han Sans SC, sans-serif",
          fontSize: 13,
          fill: 0xfff4dc,
          fontWeight: "600",
          stroke: { color: 0x140f0a, width: 4 },
        },
      });
      sign.anchor.set(0.5, 1);
      this.world.addChild(sign);
      this.worldSigns.set(id, sign);
    }
    sign.text = text;
    return sign;
  }

  private syncWorldSigns(sim: SimState): void {
    const seen = new Set<string>();
    for (const lever of sim.level.levers ?? []) {
      const id = `lever:${lever.id}`;
      seen.add(id);
      const sign = this.worldSign(id, lever.kind === "tide" ? "推过拨杆" : "推过启动");
      sign.x = lever.rect.x + lever.rect.w / 2;
      sign.y = lever.rect.y - 32;
      sign.alpha = 0.88 + Math.sin(sim.timeMs * 0.008) * 0.1;
    }
    const well = sim.level.tide?.wellPlate;
    if (well) {
      seen.add("well");
      const sign = this.worldSign("well", "推箱入井");
      sign.x = well.x + well.w / 2;
      sign.y = well.y - 88;
      sign.alpha = 0.88;
    }
    for (const [id, sign] of this.worldSigns) {
      if (seen.has(id)) continue;
      sign.destroy();
      this.worldSigns.delete(id);
    }
  }

  private paintPuzzles(sim: SimState): void {
    const g = this.mechanismFx;
    for (const ice of sim.level.tide?.ice ?? []) {
      g.roundRect(ice.x, ice.y - 4, ice.w, ice.h + 6, 4);
      g.fill({ color: 0xb9e7ff, alpha: 0.28 });
    }
    if (sim.tideLevel === 1) {
      for (const ice of sim.level.tide?.floatIce ?? []) {
        g.roundRect(ice.x, ice.y - 6, ice.w, ice.h + 8, 5);
        g.fill({ color: 0xd7f4ff, alpha: 0.55 });
        g.stroke({ color: 0x8fd4ea, width: 2, alpha: 0.7 });
      }
    }
    for (const spec of sim.level.bridges ?? []) {
      const rt = sim.bridges.find((b) => b.id === spec.id);
      if (rt?.collapsed) continue;
      const burning = rt?.ignited;
      g.roundRect(spec.rect.x, spec.rect.y - 8, spec.rect.w, spec.rect.h + 10, 4);
      g.fill({ color: burning ? 0xc45a22 : spec.oily ? 0x3a2414 : 0x6a4a2a, alpha: 0.95 });
      if (burning) {
        g.roundRect(spec.rect.x + 4, spec.rect.y - 16, spec.rect.w - 8, 10, 3);
        g.fill({ color: 0xffb040, alpha: 0.45 });
      }
    }
    for (const ash of sim.ashSolids) {
      g.roundRect(ash.x, ash.y - 6, ash.w, ash.h + 8, 5);
      g.fill({ color: 0x5b534c, alpha: 0.95 });
    }
    if (sim.level.tide) this.paintWell(sim, g);
    for (const crate of sim.crates) this.paintCrate(sim, g, crate);
    for (const lever of sim.level.levers ?? []) this.paintLever(sim, g, lever);
    for (const plate of sim.level.extraPlates ?? []) {
      const on = sim.extraHeld[plate.id];
      g.roundRect(plate.rect.x, plate.rect.y - 4, plate.rect.w, plate.rect.h + 6, 5);
      g.fill({ color: on ? (plate.who === "ember" ? 0xffa45f : 0x8edfff) : 0x6a645a, alpha: 0.85 });
    }
    for (const way of sim.level.oneWays ?? []) {
      g.roundRect(way.rect.x, way.rect.y, way.rect.w, way.rect.h, 3);
      g.fill({ color: 0x9a8b6a, alpha: 0.55 });
    }
    if (sim.level.phaseGates) {
      const lavaOpen = sim.phase === 0;
      for (const gate of sim.level.phaseGates) {
        const open = gate.side === "lava" ? lavaOpen : !lavaOpen;
        if (open) continue;
        for (const r of gate.rects) {
          g.roundRect(r.x, r.y, r.w, r.h, 3);
          g.fill({ color: gate.side === "lava" ? 0xb85a28 : 0x3a7a92, alpha: 0.88 });
        }
      }
    }
    for (const gate of sim.level.holdGates ?? []) {
      const held =
        (gate.who !== "frost" && standingOnPlate(sim.ember, gate.plate)) ||
        (gate.who !== "ember" && standingOnPlate(sim.frost, gate.plate));
      g.roundRect(gate.plate.x, gate.plate.y - 5, gate.plate.w, gate.plate.h + 7, 5);
      g.fill({ color: held ? 0xe8c56a : 0x5c564c, alpha: 0.9 });
      if (held) continue;
      for (const r of gate.rects) {
        g.roundRect(r.x, r.y, r.w, r.h, 3);
        g.fill({ color: 0x8a7048, alpha: 0.92 });
      }
    }
    if (sim.level.gear) {
      const t = sim.gearArmedMs;
      for (const win of sim.level.gear.windows) {
        const open = t !== null && t >= win.openAtMs && t < win.closeAtMs;
        if (open) continue;
        for (const r of win.solidsWhenClosed) {
          g.roundRect(r.x, r.y, r.w, r.h, 3);
          g.fill({ color: 0x6e6758, alpha: 0.9 });
        }
      }
    }
  }

  private paintRiverFx(g: Graphics, h: Hazard, timeMs: number): void {
    const r = h.rect;
    g.roundRect(r.x, r.y - 4, r.w, r.h + 10, 8);
    g.fill({ color: h.type === "water_deep" ? 0x1f4c5c : 0x3a6a78, alpha: 0.22 });
    const sheen = 0.1 + Math.sin(timeMs * 0.0035) * 0.04;
    g.roundRect(r.x, r.y - 8, r.w, 10, 3);
    g.fill({ color: 0xd7f3fb, alpha: sheen });

    const bands = Math.max(3, Math.floor(r.w / 90));
    for (let i = 0; i < bands; i++) {
      const travel = ((timeMs * 0.045 + i * 47) % Math.max(24, r.w + 40)) - 20;
      const py = r.y - 2 + Math.sin(timeMs * 0.004 + i) * 3;
      g.ellipse(r.x + travel, py, 22 + (i % 3) * 6, 3.5);
      g.stroke({ color: i % 2 === 0 ? 0xe8f7ff : 0x9ad4e8, width: 1.5, alpha: 0.28 });
    }
    const sparkles = Math.max(4, Math.floor(r.w / 80));
    for (let i = 0; i < sparkles; i++) {
      const px = r.x + 8 + ((i * 53 + timeMs * 0.03) % Math.max(12, r.w - 16));
      const py = r.y - 4 + Math.sin(timeMs * 0.008 + i * 1.7) * 5;
      g.circle(px, py, 1.4);
      g.fill({ color: 0xf4fffe, alpha: 0.35 + Math.sin(timeMs * 0.012 + i) * 0.12 });
    }
  }
}
