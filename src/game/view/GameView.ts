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
  DOOR_LATCH_MS,
  DOOR_MOTION_MS,
  PLATE_HOLD_MS,
  TILE,
} from "../engine/constants";
import { makeCamera, updateCamera, type Camera } from "../engine/camera";
import { rectsOverlap, type Rect } from "../engine/aabb";
import { actorRect } from "../engine/physics";
import type { ActorState, SimState } from "../sim/types";

const BASE = import.meta.env.BASE_URL.replace(/\/?$/, "/");

function asset(path: string): string {
  return `${BASE}${path.replace(/^\//, "")}`;
}

function frameUrls(dir: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => asset(`${dir}/${String(i).padStart(2, "0")}.png`));
}

const SPRITE_H = 168;

function criticalUrls(): string[] {
  return [
    asset("assets/characters/ember/idle/00.png"),
    asset("assets/characters/frost/idle/00.png"),
    asset("assets/levels/01/bg-far.jpg"),
    asset("assets/levels/01/bg-mid.jpg"),
    asset("assets/levels/01/lava.jpg"),
    asset("assets/levels/01/water.jpg"),
    asset("assets/levels/01/stone.png"),
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
    this.mid.alpha = 0.35;
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

  private layoutProps(sim: SimState): void {
    if (this.props.children.length > 0) return;
    const stone = this.tex("assets/levels/01/stone.png");
    const lava = this.tex("assets/levels/01/lava.jpg");
    const water = this.tex("assets/levels/01/water.jpg");
    const doorTex = this.tex("assets/levels/01/door.png");

    for (const s of sim.level.solids) {
      this.props.addChild(this.tile(stone, s));
    }
    for (const h of sim.level.hazards) {
      if (h.type === "lava_shallow") {
        const pool = this.tile(lava, { x: h.rect.x, y: h.rect.y - 10, w: h.rect.w, h: h.rect.h + 18 });
        pool.tint = 0xffcc88;
        this.props.addChild(pool);
      }
      if (h.type === "water_shallow") {
        this.props.addChild(this.tile(water, { x: h.rect.x, y: h.rect.y - 6, w: h.rect.w, h: h.rect.h + 14 }));
      }
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

    // 装饰立柱：不参与碰撞，让廊道有体积
    for (const x of [11, 19, 33, 44, 61]) {
      const col = this.tile(stone, { x: x * TILE, y: 9 * TILE, w: 18, h: 6 * TILE });
      col.alpha = 0.55;
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
    this.mid.x = -this.cam.x * 0.08;
    this.mid.y = -this.cam.y * 0.04;

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

    this.paintSteam(sim);
    this.paintMechanisms(sim, doorProgress);
    this.paintMarks(sim);
    this.pose(this.ember, sim.ember, "ember");
    this.pose(this.frost, sim.frost, "frost");
    this.wisp.x = sim.wisp.x;
    this.wisp.y = sim.wisp.y + 22;
    const wispS = 88 / Math.max(this.wisp.texture.height, 1);
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
    const fps = actor.anim === "walk" ? 12 : actor.anim === "idle" ? 8 : 10;
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
      const color = lava ? 0xffaa33 : water ? 0x88ddee : 0xc2b8a3;
      g.circle(a.x + a.w / 2, a.y + a.h, 7);
      g.fill({ color, alpha: 0.28 });
    }
  }
}
