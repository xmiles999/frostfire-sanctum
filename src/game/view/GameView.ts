import {
  Application,
  Assets,
  Cache,
  Container,
  Graphics,
  Sprite,
  Texture,
  TilingSprite,
} from "pixi.js";
import {
  BRIDGE_BURN_MS,
  BRIDGE_STAND_IGNITE_MS,
  DOOR_LATCH_MS,
  DOOR_MOTION_MS,
  IGNITE_RANGE,
  PHASE_LOCK_MS,
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

/** On-screen character height in world px. Collision is 34; keep a little cape/hair overshoot. */
const SPRITE_H = 44;
const WISP_H = 32;
const PLATE_H = 28;
const ALTAR_H = 64;
const HURT_FPS = 12;

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
    ...frameUrls("assets/characters/ember/hurt", 6),
    ...frameUrls("assets/characters/ember/downed", 4),
    ...frameUrls("assets/characters/frost/idle", 8).slice(1),
    ...frameUrls("assets/characters/frost/walk", 12),
    ...frameUrls("assets/characters/frost/jump", 6),
    ...frameUrls("assets/characters/frost/hurt", 6),
    ...frameUrls("assets/characters/frost/downed", 4),
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
  private deathFx: { x: number; y: number; who: "ember" | "frost"; age: number }[] = [];
  private downedSeen = { ember: false, frost: false };

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
    if (r.y >= worldH * 0.55) return "frost";
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
        hurt: this.seq("assets/characters/ember/hurt", 6, emberIdle0),
        downed: this.seq("assets/characters/ember/downed", 4, emberIdle0),
      },
      frost: {
        idle: this.seq("assets/characters/frost/idle", 8, frostIdle0),
        walk: this.seq("assets/characters/frost/walk", 12, frostIdle0),
        jump: this.seq("assets/characters/frost/jump", 6, frostIdle0),
        fall: this.seq("assets/characters/frost/jump", 6, frostIdle0),
        hurt: this.seq("assets/characters/frost/hurt", 6, frostIdle0),
        downed: this.seq("assets/characters/frost/downed", 4, frostIdle0),
      },
    };

    this.far = new Sprite(this.tex("assets/levels/01/bg-far.jpg"));
    this.mid = new Sprite(this.tex("assets/levels/01/bg-mid.jpg"));
    this.mid.alpha = 0.52;
    this.ember = new Sprite(this.frames.ember.idle[0]);
    this.frost = new Sprite(this.frames.frost.idle[0]);
    this.wisp = new Sprite(this.tex("assets/fx/wisp.png"));
    this.plateEmber = this.sit(this.tex("assets/ui/pressure-plate.png"), { x: 0, y: 0, w: 1, h: 1 }, PLATE_H);
    this.plateFrost = this.sit(this.tex("assets/ui/pressure-plate.png"), { x: 0, y: 0, w: 1, h: 1 }, PLATE_H);
    this.altar = this.sit(this.tex("assets/levels/01/altar.png"), { x: 0, y: 0, w: 1, h: 1 }, ALTAR_H);

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
    this.frames.ember.hurt = this.seq("assets/characters/ember/hurt", 6, emberIdle0);
    this.frames.ember.downed = this.seq("assets/characters/ember/downed", 4, this.tex("assets/characters/ember/downed/00.png"));
    this.frames.frost.idle = this.seq("assets/characters/frost/idle", 8, frostIdle0);
    this.frames.frost.walk = this.seq("assets/characters/frost/walk", 12, frostIdle0);
    this.frames.frost.jump = this.seq("assets/characters/frost/jump", 6, frostIdle0);
    this.frames.frost.fall = this.frames.frost.jump;
    this.frames.frost.hurt = this.seq("assets/characters/frost/hurt", 6, frostIdle0);
    this.frames.frost.downed = this.seq("assets/characters/frost/downed", 4, this.tex("assets/characters/frost/downed/00.png"));
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
    this.deathFx = [];
    this.downedSeen = { ember: false, frost: false };
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

    const roomW = sim.level.size.w;
    const worldHpx = sim.level.size.h * TILE;
    for (const t of [0.22, 0.44, 0.66, 0.82]) {
      const col = this.tile(wall, { x: t * roomW * TILE, y: 3 * TILE, w: 14, h: worldHpx - 4 * TILE });
      col.alpha = 0.32;
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
    this.mid.width = this.cam.w;
    this.mid.height = this.cam.h;
    this.mid.x = 0;
    this.mid.y = 0;

    this.world.scale.set(this.cam.scale);
    this.world.x = this.cam.ox;
    this.world.y = this.cam.oy;

    const showDual = sim.level.puzzle !== "tide";
    this.plateEmber.visible = showDual;
    this.plateFrost.visible = showDual;
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
    this.paintMarks(sim);
    this.syncDeath(sim, dt);
    this.wisp.visible = sim.wisp.nestX > 0;
    this.pose(this.ember, sim.ember, "ember");
    this.pose(this.frost, sim.frost, "frost");
    this.wisp.x = sim.wisp.x;
    this.wisp.y = sim.wisp.y + 14;
    const wispS = WISP_H / Math.max(this.wisp.texture.height, 1);
    this.wisp.scale.set(wispS * sim.wisp.facing, wispS);
    this.wisp.alpha = sim.wisp.phase === "idle" ? 0.85 : 1;
    this.wisp.tint = sim.wisp.phase === "acquire" ? 0xffdd88 : 0xffffff;
    this.app.render();
  }

  private pose(sprite: Sprite, actor: ActorState, who: "ember" | "frost"): void {
    const set = this.frames[who];
    const dying = actor.anim === "hurt" || actor.anim === "downed";
    const key = dying
      ? actor.anim
      : actor.anim === "fall" || actor.anim === "land"
        ? actor.anim === "land"
          ? "idle"
          : "jump"
        : actor.anim === "interact"
          ? "idle"
          : actor.anim;
    const frames = set[key] ?? set.idle;
    const fps = actor.anim === "walk" ? 14 : actor.anim === "idle" ? 8 : actor.anim === "hurt" ? HURT_FPS : 10;
    const idx = dying
      ? Math.min(frames.length - 1, Math.floor(actor.animTime * fps))
      : Math.floor(actor.animTime * fps) % frames.length;
    sprite.texture = frames[idx]!;
    sprite.x = actor.x + actor.w / 2;
    sprite.y = actor.y + actor.h;
    const s = SPRITE_H / Math.max(sprite.texture.height, 1);
    const landT = Math.max(0, Math.min(1, actor.landMs / 120));
    const deathSquash = dying ? Math.min(0.16, actor.animTime * 0.35) : 0;
    const squash = dying ? deathSquash : actor.onGround ? landT * 0.1 : 0;
    const stretch = !dying && !actor.onGround && actor.vy < -180 ? 0.035 : 0;
    sprite.scale.set(s * actor.facing * (1 + squash - stretch), s * (1 - squash + stretch));
    sprite.rotation = dying || actor.onGround ? 0 : Math.max(-0.08, Math.min(0.08, actor.vx / 4200));
    sprite.alpha = actor.invulnMs > 0 ? 0.7 : dying ? Math.max(0.78, 1 - actor.animTime * 0.12) : 1;
  }

  private syncDeath(sim: SimState, dt: number): void {
    for (const who of ["ember", "frost"] as const) {
      const actor = sim[who];
      if (actor.downed && !this.downedSeen[who]) {
        this.deathFx.push({
          x: actor.x + actor.w / 2,
          y: actor.y + actor.h * 0.55,
          who,
          age: 0,
        });
      }
      this.downedSeen[who] = actor.downed;
    }
    for (const fx of this.deathFx) fx.age += dt;
    this.deathFx = this.deathFx.filter((fx) => fx.age < 0.85);
  }

  private paintDeathFx(g: Graphics): void {
    for (const fx of this.deathFx) {
      const t = Math.min(1, fx.age / 0.85);
      const ember = fx.who === "ember";
      const count = 14;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + (ember ? 0.2 : 0.7);
        const dist = (10 + (i % 5) * 7) * (0.35 + t);
        const px = fx.x + Math.cos(ang) * dist;
        const py = fx.y + Math.sin(ang) * dist * 0.55 - t * 18;
        const r = ember ? 2.2 + (i % 3) : 1.8 + (i % 3);
        g.circle(px, py, r * (1 - t * 0.65));
        g.fill({
          color: ember ? (i % 2 ? 0xffb040 : 0xff6a1a) : i % 2 ? 0xd8f4ff : 0x8edfff,
          alpha: (1 - t) * 0.9,
        });
      }
      g.ellipse(fx.x, fx.y + 16, 16 + t * 18, 5 + t * 3);
      g.fill({ color: ember ? 0xc45a22 : 0x7ec8e8, alpha: (1 - t) * 0.28 });
    }
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

    const platePairs =
      sim.level.puzzle === "tide"
        ? []
        : [
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
      if (sim.level.puzzle === "tide") {
        const gem = this.tideSeated(sim);
        this.paintDiamond(g, cx, cy, gem ? 9 : 7, gem ? 0xf0d078 : 0x6a5a38, gem ? 1 : 0.75);
      }
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

    this.paintDeathFx(g);
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

  private paintDiamond(g: Graphics, cx: number, cy: number, s: number, color: number, alpha: number): void {
    g.poly([cx, cy - s, cx + s, cy, cx, cy + s, cx - s, cy]);
    g.fill({ color, alpha });
  }

  private tideSeated(sim: SimState): boolean {
    const plate = sim.level.tide?.wellPlate;
    const crate = sim.crates[0];
    if (!plate || !crate) return false;
    return crate.x + crate.w / 2 >= plate.x && crate.x + crate.w / 2 <= plate.x + plate.w && sim.tideLevel === 2;
  }

  private paintWell(sim: SimState, g: Graphics): void {
    const plate = sim.level.tide?.wellPlate;
    if (!plate) return;
    const seated = this.tideSeated(sim);
    const x = plate.x - 22;
    const w = plate.w + 44;
    const lipY = plate.y - 18;
    const pulse = 0.55 + Math.sin(sim.timeMs * 0.008) * 0.25;
    g.roundRect(Math.max(TILE, plate.x - 90), plate.y + 10, 70, 7, 3);
    g.fill({ color: 0x2a241c, alpha: 0.42 });
    g.roundRect(x - 8, lipY + 14, w + 16, 28, 6);
    g.fill({ color: 0x2a2620, alpha: 0.55 });
    g.roundRect(x, lipY, w, 26, 10);
    g.fill({ color: 0x6a6054, alpha: 1 });
    g.stroke({ color: 0xe4d3b0, width: 3, alpha: 0.95 });
    g.roundRect(x + 12, lipY + 8, w - 24, 16, 8);
    g.fill({ color: 0x12161c, alpha: 0.96 });
    for (const [i, hy] of [lipY + 10, lipY + 16, lipY + 22].entries()) {
      g.rect(x + 14, hy, 8, 2);
      g.rect(x + w - 22, hy, 8, 2);
      g.fill({ color: i === sim.tideLevel ? 0x7ec8a0 : 0x3a4a40, alpha: 0.85 });
    }
    const waterH = sim.tideLevel === 0 ? 5 : sim.tideLevel === 1 ? 11 : 15;
    g.roundRect(x + 14, lipY + 22 - waterH, w - 28, waterH, 5);
    g.fill({ color: sim.tideLevel === 2 ? 0x163848 : 0x2f6d82, alpha: 0.88 });
    g.roundRect(x + 18, lipY + 22 - waterH, w - 36, 3, 2);
    g.fill({ color: 0xc5eaf4, alpha: 0.35 + Math.sin(sim.timeMs * 0.006) * 0.08 });
    const socket = seated ? 0xf0d078 : sim.tideLevel === 2 ? 0xc9a24a : 0x7a6238;
    g.roundRect(plate.x + 6, plate.y, plate.w - 12, Math.max(10, plate.h), 4);
    g.fill({ color: socket, alpha: seated ? 1 : 0.55 + (sim.tideLevel === 2 ? pulse * 0.4 : 0.15) });
    this.paintDiamond(g, plate.x + plate.w / 2, plate.y + 8, seated ? 11 : 9, seated ? 0xfff3c0 : 0x3a2e18, 0.95);
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
    this.paintTideConduit(sim, g, plate, seated);
  }

  private paintTideConduit(sim: SimState, g: Graphics, plate: Rect, seated: boolean): void {
    const doors = sim.level.gatedSolids;
    if (!doors.length) return;
    const sx = plate.x + plate.w;
    const sy = plate.y + 8;
    const dx = doors[0]!.x;
    const water = sim.tideLevel === 2;
    g.roundRect(sx, sy - 3, Math.max(8, dx - sx), 6, 3);
    g.fill({ color: water ? 0x2f6d82 : 0x3a3530, alpha: water ? 0.7 : 0.4 });
    if (seated) {
      const t = (sim.timeMs * 0.08) % Math.max(24, dx - sx);
      g.roundRect(sx + t, sy - 4, 18, 8, 3);
      g.fill({ color: 0xf0d078, alpha: 0.85 });
    }
    for (const door of doors) {
      const dy = door.y + door.h / 2;
      g.roundRect(door.x - 5, Math.min(sy, dy), 6, Math.abs(dy - sy), 3);
      g.fill({ color: seated ? 0xf0d078 : water ? 0x2f6d82 : 0x3a3530, alpha: seated ? 0.85 : 0.45 });
    }
  }

  private paintCrate(sim: SimState, g: Graphics, crate: CrateState): void {
    g.roundRect(crate.x, crate.y, crate.w, crate.h, 5);
    g.fill({ color: 0x8d6a3c, alpha: 1 });
    g.stroke({ color: 0xe6d2a8, width: 2, alpha: 0.95 });
    g.roundRect(crate.x + 5, crate.y + 6, crate.w - 10, 5, 2);
    g.roundRect(crate.x + 5, crate.y + crate.h - 11, crate.w - 10, 5, 2);
    g.fill({ color: 0x4d4538, alpha: 0.95 });
    this.paintDiamond(g, crate.x + crate.w / 2, crate.y + crate.h / 2, 9, 0xf0d078, 0.95);
    this.paintDiamond(g, crate.x + crate.w / 2, crate.y + crate.h / 2, 4, 0x3a2e18, 0.9);
    if (sim.tideLevel > 0) {
      g.roundRect(crate.x + 6, crate.y + 8, crate.w - 12, 7, 2);
      g.fill({ color: 0x6aa0c8, alpha: 0.4 + sim.tideLevel * 0.18 });
    }
  }

  private paintLever(sim: SimState, g: Graphics, lever: LeverSpec): void {
    const r = lever.rect;
    const cx = r.x + r.w * 0.42;
    const baseY = r.y + r.h;
    g.roundRect(r.x - 48, baseY + 1, 70, 7, 3);
    g.fill({ color: 0x2c261e, alpha: 0.55 });
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
        g.fill({ color: i === sim.tideLevel ? 0x7ec8a0 : 0x3a4a40, alpha: 1 });
      }
      const well = sim.level.tide?.wellPlate;
      if (well) {
        const wet = sim.tideLevel === 2;
        g.roundRect(gaugeX + 6, gaugeY + 64, 4, well.y - (gaugeY + 64), 2);
        g.fill({ color: wet ? 0x2f6d82 : 0x3a3530, alpha: wet ? 0.65 : 0.35 });
      }
    } else {
      g.roundRect(gaugeX + 3, gaugeY + 8, 10, sim.gearArmedMs !== null ? 48 : 10, 3);
      g.fill({ color: sim.gearArmedMs !== null ? 0xe08a3a : 0x6a645a, alpha: 0.95 });
    }
    const idle =
      (lever.kind === "tide" && sim.tideLevel === 0) || (lever.kind === "gear" && sim.gearArmedMs === null);
    const wobble = idle ? Math.sin(sim.timeMs * 0.007) * 0.1 : 0;
    const angle =
      (lever.kind === "tide"
        ? sim.tideLevel === 0
          ? -2.55
          : sim.tideLevel === 2
            ? 1.05
            : 0.22
        : sim.gearArmedMs !== null
          ? 0.9
          : -2.55) + wobble;
    const len = 70;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const nx = -s * 6;
    const ny = c * 6;
    const hx = cx + c * len;
    const hy = r.y + 18 + s * len;
    g.poly([cx + nx, r.y + 18 + ny, hx + nx, hy + ny, hx - nx, hy - ny, cx - nx, r.y + 18 - ny]);
    g.fill({ color: lever.kind === "tide" ? 0xc4a36a : 0xb0a898, alpha: 1 });
    g.stroke({ color: 0xf0e2c4, width: 1.5, alpha: 0.85 });
    g.circle(cx, r.y + 18, 8);
    g.fill({ color: 0x8a7a58, alpha: 1 });
    g.stroke({ color: 0xf2e6c8, width: 2, alpha: 0.9 });
    g.circle(hx, hy, 11);
    g.fill({ color: 0xe8dcc4, alpha: 1 });
    g.stroke({ color: 0x5a4030, width: 2, alpha: 0.85 });
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
    this.paintBridges(sim, g);
    if (sim.level.tide) this.paintWell(sim, g);
    for (const crate of sim.crates) this.paintCrate(sim, g, crate);
    for (const lever of sim.level.levers ?? []) this.paintLever(sim, g, lever);
    this.paintPhaseMachine(sim, g);
    this.paintHoldGates(sim, g);
    this.paintGearMachine(sim, g);
  }

  private paintChevron(g: Graphics, cx: number, cy: number, s: number, color: number, alpha: number): void {
    g.poly([cx, cy - s, cx + s, cy + s * 0.55, cx, cy + s * 0.12, cx - s, cy + s * 0.55]);
    g.fill({ color, alpha });
  }

  private paintLink(
    g: Graphics,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    lit: boolean,
    color: number,
    timeMs: number,
  ): void {
    const x0 = Math.min(ax, bx);
    const y0 = Math.min(ay, by);
    g.roundRect(x0, ay - 2.5, Math.max(6, Math.abs(bx - ax)), 5, 2);
    g.fill({ color: lit ? color : 0x3a3530, alpha: lit ? 0.72 : 0.36 });
    g.roundRect(bx - 2.5, y0, 5, Math.max(6, Math.abs(by - ay)), 2);
    g.fill({ color: lit ? color : 0x3a3530, alpha: lit ? 0.72 : 0.36 });
    if (!lit) return;
    const span = Math.max(24, Math.abs(bx - ax) + Math.abs(by - ay));
    const t = (timeMs * 0.09) % span;
    const px = ax + Math.sign(bx - ax || 1) * Math.min(t, Math.abs(bx - ax));
    const py = t <= Math.abs(bx - ax) ? ay : ay + Math.sign(by - ay || 1) * (t - Math.abs(bx - ax));
    g.roundRect(px - 5, py - 3.5, 12, 7, 3);
    g.fill({ color, alpha: 0.9 });
  }

  private paintBridges(sim: SimState, g: Graphics): void {
    for (const spec of sim.level.bridges ?? []) {
      if (spec.ashRect && !sim.ashSolids.some((a) => a.x === spec.ashRect!.x && a.y === spec.ashRect!.y)) {
        const pit = spec.ashRect;
        g.roundRect(pit.x + 6, pit.y - 2, pit.w - 12, pit.h + 6, 4);
        g.fill({ color: 0x1a1612, alpha: 0.72 });
        this.paintDiamond(g, pit.x + pit.w / 2, pit.y + 6, 8, 0x3a2e18, 0.9);
      }
    }
    for (const spec of sim.level.bridges ?? []) {
      const rt = sim.bridges.find((b) => b.id === spec.id);
      if (rt?.collapsed) continue;
      const r = spec.rect;
      const burning = Boolean(rt?.ignited);
      const plank = burning ? 0xc45a22 : spec.oily ? 0x3a2414 : 0x6a4a2a;
      g.roundRect(r.x, r.y - 8, r.w, r.h + 10, 4);
      g.fill({ color: plank, alpha: 0.96 });
      g.stroke({ color: spec.oily ? 0x2a1810 : 0xc4a070, width: 2, alpha: 0.7 });
      const planks = Math.max(3, Math.floor(r.w / 28));
      for (let i = 1; i < planks; i++) {
        g.rect(r.x + (r.w * i) / planks, r.y - 6, 2, r.h + 6);
        g.fill({ color: 0x1c140e, alpha: 0.45 });
      }
      if (spec.oily) {
        const sheen = 0.18 + Math.sin(sim.timeMs * 0.006) * 0.08;
        g.roundRect(r.x + 10, r.y - 4, r.w - 20, 5, 2);
        g.fill({ color: 0x1a0e08, alpha: 0.85 });
        g.roundRect(r.x + 16, r.y - 6, r.w - 32, 3, 2);
        g.fill({ color: 0x6a3a14, alpha: sheen });
        this.paintDiamond(g, r.x + r.w / 2, r.y + 6, 9, burning ? 0xffd078 : 0x8a5a28, 0.95);
        if (spec.ashRect) {
          this.paintLink(
            g,
            r.x + r.w / 2,
            r.y + 8,
            spec.ashRect.x + spec.ashRect.w / 2,
            spec.ashRect.y + 6,
            burning || Boolean(rt?.collapsed),
            0xe08a3a,
            sim.timeMs,
          );
        }
        const emberC = { x: sim.ember.x + sim.ember.w / 2, y: sim.ember.y + sim.ember.h / 2 };
        const inRange =
          !sim.ember.downed &&
          Math.abs(emberC.x - (r.x + r.w / 2)) <= 2.2 * TILE &&
          Math.abs(emberC.y - (r.y + r.h / 2)) <= IGNITE_RANGE;
        const torchX = r.x + r.w / 2;
        const torchY = r.y - 3.6 * TILE;
        g.roundRect(torchX - 7, torchY - 18, 14, 22, 3);
        g.fill({ color: 0x4a3a2a, alpha: 1 });
        g.circle(torchX, torchY - 22, inRange || burning ? 11 : 7);
        g.fill({ color: inRange || burning ? 0xffb040 : 0x6a4030, alpha: inRange ? 0.95 : 0.7 });
        if (inRange && !burning) {
          const pulse = 0.45 + Math.sin(sim.timeMs * 0.02) * 0.25;
          g.circle(torchX, torchY - 28, 6 + pulse * 4);
          g.fill({ color: 0xffe08a, alpha: pulse });
          this.paintLink(g, torchX, torchY - 18, r.x + r.w / 2, r.y - 4, true, 0xffa45f, sim.timeMs);
        }
        if (!burning && rt && rt.burnMs > 0) {
          const heat = Math.min(1, rt.burnMs / BRIDGE_STAND_IGNITE_MS);
          g.roundRect(r.x + 8, r.y - 18, (r.w - 16) * heat, 5, 2);
          g.fill({ color: 0xff8a3a, alpha: 0.9 });
        }
      }
      if (burning && rt) {
        const t = Math.min(1, rt.burnMs / BRIDGE_BURN_MS);
        g.roundRect(r.x + 4, r.y - 18, r.w - 8, 10, 3);
        g.fill({ color: 0xffb040, alpha: 0.4 + t * 0.35 });
        for (let i = 0; i < 5; i++) {
          const px = r.x + 12 + ((i * 37 + sim.timeMs * 0.04) % Math.max(12, r.w - 24));
          const py = r.y - 10 - ((sim.timeMs * 0.05 + i * 11) % 22);
          g.circle(px, py, 3 + (i % 2));
          g.fill({ color: 0xffe08a, alpha: 0.55 });
        }
        if (spec.ashRect) {
          const fall = ((sim.timeMs * 0.12) % 1 + 1) % 1;
          const ax = spec.ashRect.x + spec.ashRect.w / 2;
          const ay = spec.ashRect.y;
          g.circle(r.x + r.w / 2 + (ax - r.x - r.w / 2) * fall, r.y + (ay - r.y) * fall, 4);
          g.fill({ color: 0xc45a22, alpha: 0.8 * (1 - fall) });
        }
      }
    }
    for (const ash of sim.ashSolids) {
      g.roundRect(ash.x, ash.y - 10, ash.w, ash.h + 12, 6);
      g.fill({ color: 0x5b534c, alpha: 0.96 });
      g.roundRect(ash.x + 8, ash.y - 16, ash.w - 16, 10, 4);
      g.fill({ color: 0x3a3530, alpha: 0.8 });
      this.paintDiamond(g, ash.x + ash.w / 2, ash.y, 10, 0xf0d078, 0.95);
    }
  }

  private paintPhaseMachine(sim: SimState, g: Graphics): void {
    for (const way of sim.level.oneWays ?? []) {
      g.roundRect(way.rect.x, way.rect.y, way.rect.w, way.rect.h, 3);
      g.fill({ color: 0x9a8b6a, alpha: 0.55 });
      const cx = way.rect.x + way.rect.w / 2;
      const cy = way.rect.y + way.rect.h / 2;
      for (let i = 0; i < 3; i++) {
        const ox = cx + (i - 1) * 7 * way.dir;
        g.poly([ox - 5 * way.dir, cy - 8, ox + 7 * way.dir, cy, ox - 5 * way.dir, cy + 8]);
        g.fill({ color: 0xf0e2c4, alpha: 0.55 + i * 0.15 });
      }
    }
    if (!sim.level.phaseGates?.length) return;
    const lavaOpen = sim.phase === 0;
    const gx = sim.level.phaseGates[0]!.rects[0]!.x + 28;
    const gy = sim.level.size.h * TILE * 0.5;
    g.circle(gx, gy, 22);
    g.fill({ color: 0x2a2620, alpha: 0.92 });
    g.stroke({ color: 0xb7a078, width: 3, alpha: 0.9 });
    const spin = sim.timeMs * 0.002 + (lavaOpen ? 0 : Math.PI);
    for (let i = 0; i < 6; i++) {
      const a = spin + (i * Math.PI) / 3;
      const lavaTooth = i % 2 === 0;
      const live = lavaTooth ? lavaOpen : !lavaOpen;
      g.poly([
        gx + Math.cos(a) * 8,
        gy + Math.sin(a) * 8,
        gx + Math.cos(a - 0.28) * 20,
        gy + Math.sin(a - 0.28) * 20,
        gx + Math.cos(a + 0.28) * 20,
        gy + Math.sin(a + 0.28) * 20,
      ]);
      g.fill({ color: lavaTooth ? 0xb85a28 : 0x3a7a92, alpha: live ? 0.95 : 0.35 });
    }
    if (sim.phaseLockMs > 0) {
      const t = sim.phaseLockMs / PHASE_LOCK_MS;
      g.arc(gx, gy, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
      g.stroke({ color: 0xe8c56a, width: 4, alpha: 0.95 });
    }
    for (const gate of sim.level.phaseGates) {
      const open = gate.side === "lava" ? lavaOpen : !lavaOpen;
      const color = gate.side === "lava" ? 0xb85a28 : 0x3a7a92;
      for (const r of gate.rects) {
        const cx = r.x + r.w / 2;
        if (open) {
          g.roundRect(r.x - 4, r.y - 10, r.w + 8, 14, 3);
          g.fill({ color, alpha: 0.55 });
        } else {
          g.roundRect(r.x, r.y, r.w, r.h, 3);
          g.fill({ color, alpha: 0.9 });
          g.roundRect(r.x + 2, r.y + 8, r.w - 4, r.h - 16, 2);
          g.fill({ color: 0x1a1612, alpha: 0.35 });
        }
        this.paintDiamond(g, cx, r.y + (open ? 4 : r.h / 2), 7, open ? 0xfff3c0 : 0x3a2e18, 0.9);
        this.paintLink(g, gx, gy, cx, r.y + r.h / 2, open, color, sim.timeMs);
      }
    }
    for (const plate of sim.level.extraPlates ?? []) {
      const on = sim.extraHeld[plate.id];
      const color = plate.who === "ember" ? 0xffa45f : 0x8edfff;
      g.roundRect(plate.rect.x, plate.rect.y - 4, plate.rect.w, plate.rect.h + 6, 5);
      g.fill({ color: on ? color : 0x4a453c, alpha: 0.92 });
      this.paintDiamond(g, plate.rect.x + plate.rect.w / 2, plate.rect.y + 2, 8, on ? 0xfff3c0 : color, 0.9);
      this.paintLink(g, plate.rect.x + plate.rect.w / 2, plate.rect.y, gx, gy, on, color, sim.timeMs);
    }
  }

  private paintHoldGates(sim: SimState, g: Graphics): void {
    for (const gate of sim.level.holdGates ?? []) {
      const held =
        (gate.who !== "frost" && standingOnPlate(sim.ember, gate.plate)) ||
        (gate.who !== "ember" && standingOnPlate(sim.frost, gate.plate));
      const color = gate.who === "frost" ? 0x8edfff : 0xffa45f;
      g.roundRect(gate.plate.x - 4, gate.plate.y - 6, gate.plate.w + 8, gate.plate.h + 10, 6);
      g.fill({ color: 0x2c261e, alpha: 0.8 });
      g.roundRect(gate.plate.x, gate.plate.y - 4, gate.plate.w, gate.plate.h + 6, 4);
      g.fill({ color: held ? color : 0x5c564c, alpha: 0.95 });
      this.paintChevron(g, gate.plate.x + gate.plate.w / 2, gate.plate.y - 2, 8, held ? 0xfff3c0 : 0xc4b08a, 0.95);
      for (const r of gate.rects) {
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        if (held) {
          g.roundRect(r.x - 3, r.y, r.w + 6, 10, 3);
          g.fill({ color, alpha: 0.45 });
        } else {
          g.roundRect(r.x, r.y, r.w, r.h, 3);
          g.fill({ color: 0x8a7048, alpha: 0.94 });
          g.roundRect(r.x + 3, r.y + 10, r.w - 6, r.h - 20, 2);
          g.fill({ color: 0x2a2218, alpha: 0.35 });
        }
        this.paintChevron(g, cx, held ? r.y + 8 : cy, 8, held ? 0xfff3c0 : 0x3a2e18, 0.95);
        this.paintLink(g, gate.plate.x + gate.plate.w, gate.plate.y, cx, cy, held, color, sim.timeMs);
      }
    }
  }

  private paintGearMachine(sim: SimState, g: Graphics): void {
    const spec = sim.level.gear;
    if (!spec) return;
    const t = sim.gearArmedMs;
    const lever = sim.level.levers?.find((l) => l.kind === "gear");
    const lx = lever ? lever.rect.x + lever.rect.w : 0;
    const ly = lever ? lever.rect.y + lever.rect.h / 2 : 0;
    const ages = [0.85, 0.5, 0.22];
    for (const [i, win] of spec.windows.entries()) {
      const r = win.solidsWhenClosed[0];
      if (!r) continue;
      g.ellipse(r.x - 8, r.y + r.h, 16 + i * 2, 5);
      g.fill({ color: 0x3a2a18, alpha: ages[i] ?? 0.4 });
    }
    for (const win of spec.windows) {
      const open = t !== null && t >= win.openAtMs && t < win.closeAtMs;
      const fake = win.id.includes("early") || win.id.includes("fake");
      const fire = win.id.includes("fire");
      const color = fire ? 0xffa45f : fake ? 0x6a8890 : 0x8edfff;
      for (const r of win.solidsWhenClosed) {
        const cx = r.x + r.w / 2;
        const top = r.y - 18;
        const swing = open ? Math.sin(sim.timeMs * 0.012) * 0.45 : 0;
        g.roundRect(cx - 3, top - 8, 6, 12, 2);
        g.fill({ color: 0x6a6054, alpha: 1 });
        g.ellipse(cx + Math.sin(swing) * 8, top + 10 + Math.abs(Math.sin(swing)) * 2, 9, 12);
        g.fill({ color: open ? 0xe8c56a : 0x6e6758, alpha: 0.95 });
        g.stroke({ color: 0xf0e2c4, width: 1.5, alpha: open ? 0.9 : 0.4 });
        if (open) {
          g.roundRect(r.x - 4, r.y, r.w + 8, 8, 3);
          g.fill({ color, alpha: 0.5 });
          g.roundRect(r.x - 4, r.y + r.h - 8, r.w + 8, 8, 3);
          g.fill({ color, alpha: 0.5 });
        } else {
          g.roundRect(r.x, r.y, r.w, r.h, 3);
          g.fill({ color: fake ? 0x5a5048 : 0x6e6758, alpha: 0.94 });
          if (fake) {
            g.rect(r.x + 2, r.y + 16, r.w - 4, 3);
            g.fill({ color: 0x2a2218, alpha: 0.55 });
            g.rect(r.x + 4, r.y + r.h * 0.55, r.w - 8, 2);
            g.fill({ color: 0x8a7048, alpha: 0.4 });
          }
        }
        this.paintDiamond(g, cx, open ? r.y + 10 : r.y + r.h / 2, 7, open ? 0xfff3c0 : color, 0.9);
        if (lever) this.paintLink(g, lx, ly, cx, r.y + 12, open, color, sim.timeMs);
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
