import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Texture,
  TilingSprite,
} from "pixi.js";
import { TILE } from "../engine/constants";
import { makeCamera, updateCamera, type Camera } from "../engine/camera";
import { rectsOverlap } from "../engine/aabb";
import { actorRect } from "../engine/physics";
import type { ActorState, SimState } from "../sim/types";

const BASE = import.meta.env.BASE_URL.replace(/\/?$/, "/");

function asset(path: string): string {
  return `${BASE}${path.replace(/^\//, "")}`;
}

function frameUrls(dir: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => asset(`${dir}/${String(i).padStart(2, "0")}.png`));
}

export class GameView {
  readonly app: Application;
  private world = new Container();
  private far!: Sprite;
  private mid!: Sprite;
  private lava!: TilingSprite;
  private water!: TilingSprite;
  private overlay = new Graphics();
  private ember!: Sprite;
  private frost!: Sprite;
  private wisp!: Sprite;
  private doorA!: Graphics;
  private doorB!: Graphics;
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
    const urls = [
      ...frameUrls("assets/characters/ember/idle", 8),
      ...frameUrls("assets/characters/ember/walk", 12),
      ...frameUrls("assets/characters/ember/jump", 6),
      asset("assets/characters/ember/downed/00.png"),
      ...frameUrls("assets/characters/frost/idle", 8),
      ...frameUrls("assets/characters/frost/walk", 12),
      ...frameUrls("assets/characters/frost/jump", 6),
      asset("assets/characters/frost/downed/00.png"),
      asset("assets/levels/01/bg-far.jpg"),
      asset("assets/levels/01/bg-mid.jpg"),
      asset("assets/levels/01/lava.jpg"),
      asset("assets/levels/01/water.jpg"),
      asset("assets/fx/wisp.png"),
    ];
    await Assets.load(urls);
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");

    const rect = parent.getBoundingClientRect();
    const width = Math.max(Math.floor(rect.width), window.innerWidth || 1280, 640);
    const height = Math.max(Math.floor(rect.height), window.innerHeight || 720, 360);

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
    return view;
  }

  private tex(path: string): Texture {
    const url = asset(path);
    return (Assets.get(url) as Texture | undefined) ?? Texture.from(url);
  }

  private seq(dir: string, count: number): Texture[] {
    return frameUrls(dir, count).map((u) => (Assets.get(u) as Texture | undefined) ?? Texture.from(u));
  }

  private build(): void {
    this.frames = {
      ember: {
        idle: this.seq("assets/characters/ember/idle", 8),
        walk: this.seq("assets/characters/ember/walk", 12),
        jump: this.seq("assets/characters/ember/jump", 6),
        fall: this.seq("assets/characters/ember/jump", 6),
        downed: [this.tex("assets/characters/ember/downed/00.png")],
      },
      frost: {
        idle: this.seq("assets/characters/frost/idle", 8),
        walk: this.seq("assets/characters/frost/walk", 12),
        jump: this.seq("assets/characters/frost/jump", 6),
        fall: this.seq("assets/characters/frost/jump", 6),
        downed: [this.tex("assets/characters/frost/downed/00.png")],
      },
    };

    this.far = new Sprite(this.tex("assets/levels/01/bg-far.jpg"));
    this.mid = new Sprite(this.tex("assets/levels/01/bg-mid.jpg"));
    this.lava = new TilingSprite({
      texture: this.tex("assets/levels/01/lava.jpg"),
      width: 72 * TILE,
      height: 96,
    });
    this.water = new TilingSprite({
      texture: this.tex("assets/levels/01/water.jpg"),
      width: 72 * TILE,
      height: 96,
    });
    this.ember = new Sprite(this.frames.ember.idle[0]);
    this.frost = new Sprite(this.frames.frost.idle[0]);
    this.wisp = new Sprite(this.tex("assets/fx/wisp.png"));
    this.doorA = new Graphics();
    this.doorB = new Graphics();

    for (const s of [this.ember, this.frost, this.wisp]) {
      s.anchor.set(0.5, 1);
    }
    this.ember.scale.set(0.22);
    this.frost.scale.set(0.22);
    this.wisp.scale.set(0.18);

    this.app.stage.addChild(this.world);
    // 前景原图抠绿失败，整张不透明，不能盖在玩法层上。
    this.world.addChild(
      this.far,
      this.mid,
      this.lava,
      this.water,
      this.overlay,
      this.doorA,
      this.doorB,
      this.frost,
      this.ember,
      this.wisp,
    );
  }

  destroy(): void {
    try {
      this.app.destroy({ removeView: false }, { children: true });
    } catch {
      /* already destroyed */
    }
  }

  render(sim: SimState, dt: number): void {
    this.cam.w = Math.max(this.parent.clientWidth, this.app.renderer.width, 640);
    this.cam.h = Math.max(this.parent.clientHeight, this.app.renderer.height, 360);
    updateCamera(this.cam, sim, dt);
    const worldW = sim.level.size.w * TILE;
    const worldH = sim.level.size.h * TILE;

    this.far.width = worldW * 1.15;
    this.far.height = worldH * 1.1;
    this.far.x = -this.cam.x * 0.25;
    this.far.y = -this.cam.y * 0.15;
    this.mid.width = worldW;
    this.mid.height = worldH;
    this.mid.alpha = 0.55;
    this.mid.x = -this.cam.x * 0.35;
    this.mid.y = -this.cam.y * 0.2;

    this.world.x = -this.cam.x;
    this.world.y = -this.cam.y;

    this.lava.y = 7.2 * TILE;
    this.lava.tilePosition.x = sim.timeMs * 0.03;
    this.water.y = 13.4 * TILE;
    this.water.tilePosition.x = sim.timeMs * 0.02;

    this.paintWorld(sim);
    this.pose(this.ember, sim.ember, "ember");
    this.pose(this.frost, sim.frost, "frost");
    this.wisp.x = sim.wisp.x;
    this.wisp.y = sim.wisp.y + 18;
    this.wisp.scale.x = 0.18 * sim.wisp.facing;
    this.wisp.tint = sim.wisp.phase === "acquire" ? 0xffdd88 : 0xffffff;
    this.app.render();
  }

  private pose(sprite: Sprite, actor: ActorState, who: "ember" | "frost"): void {
    const set = this.frames[who];
    const key = actor.anim === "fall" ? "jump" : actor.anim === "interact" ? "idle" : actor.anim;
    const frames = set[key] ?? set.idle;
    const fps = actor.anim === "walk" ? 12 : actor.anim === "idle" ? 8 : 10;
    const idx = Math.floor(actor.animTime * fps) % frames.length;
    sprite.texture = frames[idx]!;
    sprite.x = actor.x + actor.w / 2;
    sprite.y = actor.y + actor.h;
    sprite.scale.x = 0.22 * actor.facing;
    sprite.alpha = actor.invulnMs > 0 ? 0.7 : 1;
  }

  private paintWorld(sim: SimState): void {
    const g = this.overlay;
    g.clear();
    for (const s of sim.level.solids) {
      g.rect(s.x, s.y, s.w, s.h);
      g.fill({ color: 0x1b1e24, alpha: 0.55 });
      g.rect(s.x, s.y, s.w, 5);
      g.fill({ color: 0x6a5846, alpha: 0.9 });
    }
    for (const h of sim.level.hazards) {
      if (h.type === "lava_shallow") {
        g.rect(h.rect.x, h.rect.y, h.rect.w, h.rect.h);
        g.fill({ color: 0xff6a1a, alpha: 0.45 });
      } else if (h.type === "water_shallow") {
        g.rect(h.rect.x, h.rect.y, h.rect.w, h.rect.h);
        g.fill({ color: 0x3aa0c8, alpha: 0.4 });
      } else if (h.type === "steam_hot") {
        const a =
          sim.steamPhase === "lethal" ? 0.55 : sim.steamPhase === "telegraph" ? 0.28 : 0.06;
        g.rect(h.rect.x, h.rect.y, h.rect.w, h.rect.h);
        g.fill({ color: 0xf2f2f0, alpha: a });
      }
    }
    const pe = sim.level.plates.ember;
    const pf = sim.level.plates.frost;
    g.rect(pe.x, pe.y, pe.w, pe.h);
    g.fill({ color: sim.plateEmber ? 0xffaa44 : 0x774422, alpha: 0.9 });
    g.rect(pf.x, pf.y, pf.w, pf.h);
    g.fill({ color: sim.plateFrost ? 0x88ddff : 0x335566, alpha: 0.9 });
    g.rect(sim.level.exits.ember.x, sim.level.exits.ember.y, sim.level.exits.ember.w, sim.level.exits.ember.h);
    g.stroke({ color: 0xff8844, width: 2, alpha: 0.8 });
    g.rect(sim.level.exits.frost.x, sim.level.exits.frost.y, sim.level.exits.frost.w, sim.level.exits.frost.h);
    g.stroke({ color: 0x88ccff, width: 2, alpha: 0.8 });
    g.rect(sim.level.altar.x, sim.level.altar.y, sim.level.altar.w, sim.level.altar.h);
    g.fill({ color: 0xc9a44c, alpha: 0.35 });

    this.doorA.clear();
    this.doorB.clear();
    if (!sim.doorOpen) {
      for (const [door, s] of [
        [this.doorA, sim.level.gatedSolids[0]],
        [this.doorB, sim.level.gatedSolids[1]],
      ] as const) {
        if (!s) continue;
        door.rect(s.x, s.y, s.w, s.h);
        door.fill({ color: 0x2a241c });
        door.stroke({ color: 0xd4a24a, width: 2 });
      }
    }

    for (const a of [sim.ember, sim.frost]) {
      if (!a.onGround || Math.abs(a.vx) < 20) continue;
      const lava = sim.level.hazards.some((h) => h.type === "lava_shallow" && rectsOverlap(actorRect(a), h.rect));
      const water = sim.level.hazards.some((h) => h.type === "water_shallow" && rectsOverlap(actorRect(a), h.rect));
      const color = lava ? 0xffaa33 : water ? 0x88ddee : 0xc2b8a3;
      g.circle(a.x + a.w / 2, a.y + a.h, 6);
      g.fill({ color, alpha: 0.25 });
    }
  }
}
