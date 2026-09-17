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

async function loadFrames(base: string, count: number): Promise<Texture[]> {
  const out: Texture[] = [];
  for (let i = 0; i < count; i++) {
    const url = `${base}/${String(i).padStart(2, "0")}.png`;
    out.push(await Assets.load(url));
  }
  return out;
}

export class GameView {
  readonly app: Application;
  private world = new Container();
  private far!: Sprite;
  private mid!: Sprite;
  private fg!: Sprite;
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
    this.cam = makeCamera(parent.clientWidth || 1280, parent.clientHeight || 720);
  }

  static async create(canvas: HTMLCanvasElement, parent: HTMLElement): Promise<GameView> {
    const app = new Application();
    await app.init({
      canvas,
      background: "#07080c",
      antialias: true,
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      resizeTo: parent,
    });
    const view = new GameView(app, parent);
    await view.load();
    return view;
  }

  private async load(): Promise<void> {
    const emberIdle = await loadFrames("/assets/characters/ember/idle", 8);
    const emberWalk = await loadFrames("/assets/characters/ember/walk", 12);
    const emberJump = await loadFrames("/assets/characters/ember/jump", 6);
    const emberDown = [await Assets.load("/assets/characters/ember/downed/00.png")];
    const frostIdle = await loadFrames("/assets/characters/frost/idle", 8);
    const frostWalk = await loadFrames("/assets/characters/frost/walk", 12);
    const frostJump = await loadFrames("/assets/characters/frost/jump", 6);
    const frostDown = [await Assets.load("/assets/characters/frost/downed/00.png")];
    const far = await Assets.load("/assets/levels/01/bg-far.jpg");
    const mid = await Assets.load("/assets/levels/01/bg-mid.jpg");
    const fg = await Assets.load("/assets/levels/01/fg.png");
    const lava = await Assets.load("/assets/levels/01/lava.jpg");
    const water = await Assets.load("/assets/levels/01/water.jpg");
    const wisp = await Assets.load("/assets/fx/wisp.png");

    this.frames = {
      ember: { idle: emberIdle, walk: emberWalk, jump: emberJump, fall: emberJump, downed: emberDown },
      frost: { idle: frostIdle, walk: frostWalk, jump: frostJump, fall: frostJump, downed: frostDown },
    };

    this.far = new Sprite(far);
    this.mid = new Sprite(mid);
    this.fg = new Sprite(fg);
    this.lava = new TilingSprite({ texture: lava, width: 72 * TILE, height: 96 });
    this.water = new TilingSprite({ texture: water, width: 72 * TILE, height: 96 });
    this.ember = new Sprite(emberIdle[0]);
    this.frost = new Sprite(frostIdle[0]);
    this.wisp = new Sprite(wisp);
    this.doorA = new Graphics();
    this.doorB = new Graphics();

    for (const s of [this.ember, this.frost, this.wisp]) {
      s.anchor.set(0.5, 1);
    }
    this.ember.scale.set(0.22);
    this.frost.scale.set(0.22);
    this.wisp.scale.set(0.18);

    this.app.stage.addChild(this.world);
    this.world.addChild(this.far, this.mid, this.lava, this.water, this.overlay, this.doorA, this.doorB, this.frost, this.ember, this.wisp, this.fg);
  }

  destroy(): void {
    this.app.destroy(true);
  }

  render(sim: SimState, dt: number): void {
    this.cam.w = this.parent.clientWidth || this.cam.w;
    this.cam.h = this.parent.clientHeight || this.cam.h;
    updateCamera(this.cam, sim, dt);
    const worldW = sim.level.size.w * TILE;
    const worldH = sim.level.size.h * TILE;

    this.far.width = worldW * 1.15;
    this.far.height = worldH * 1.1;
    this.far.x = -this.cam.x * 0.25;
    this.far.y = -this.cam.y * 0.15;
    this.mid.width = worldW;
    this.mid.height = worldH;
    this.mid.x = -this.cam.x * 0.55;
    this.mid.y = -this.cam.y * 0.4;
    this.fg.width = worldW;
    this.fg.height = worldH;
    this.fg.x = -this.cam.x * 1.12;
    this.fg.y = -this.cam.y * 1.05;
    this.fg.alpha = 0.55;

    this.world.x = -this.cam.x;
    this.world.y = -this.cam.y;

    this.lava.y = 7.2 * TILE;
    this.lava.tilePosition.x = sim.timeMs * 0.03;
    this.water.y = 13.4 * TILE;
    this.water.tilePosition.x = sim.timeMs * 0.02;

    this.paintWorld(sim);
    this.pose(this.ember, sim.ember, "ember", sim);
    this.pose(this.frost, sim.frost, "frost", sim);
    this.wisp.x = sim.wisp.x;
    this.wisp.y = sim.wisp.y + 18;
    this.wisp.scale.x = 0.18 * sim.wisp.facing;
    const telegraph = sim.steamPhase === "telegraph" || sim.steamPhase === "lethal";
    this.wisp.tint = sim.wisp.phase === "acquire" ? 0xffdd88 : 0xffffff;
    this.ember.zIndex = sim.ember.y;
    this.frost.zIndex = sim.frost.y;
    void telegraph;
  }

  private pose(sprite: Sprite, actor: ActorState, who: "ember" | "frost", sim: SimState): void {
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
    void sim;
  }

  private paintWorld(sim: SimState): void {
    const g = this.overlay;
    g.clear();
    for (const s of sim.level.solids) {
      g.rect(s.x, s.y, s.w, s.h).fill({ color: 0x1b1e24, alpha: 0.55 });
      g.rect(s.x, s.y, s.w, 5).fill({ color: 0x6a5846, alpha: 0.8 });
    }
    for (const h of sim.level.hazards) {
      if (h.type === "lava_shallow") {
        g.rect(h.rect.x, h.rect.y, h.rect.w, h.rect.h).fill({ color: 0xff6a1a, alpha: 0.45 });
      } else if (h.type === "water_shallow") {
        g.rect(h.rect.x, h.rect.y, h.rect.w, h.rect.h).fill({ color: 0x3aa0c8, alpha: 0.4 });
      } else if (h.type === "steam_hot") {
        const a =
          sim.steamPhase === "lethal" ? 0.55 : sim.steamPhase === "telegraph" ? 0.28 : 0.06;
        g.rect(h.rect.x, h.rect.y, h.rect.w, h.rect.h).fill({ color: 0xf2f2f0, alpha: a });
      }
    }
    const pe = sim.level.plates.ember;
    const pf = sim.level.plates.frost;
    g.rect(pe.x, pe.y, pe.w, pe.h).fill({ color: sim.plateEmber ? 0xffaa44 : 0x774422, alpha: 0.9 });
    g.rect(pf.x, pf.y, pf.w, pf.h).fill({ color: sim.plateFrost ? 0x88ddff : 0x335566, alpha: 0.9 });
    if (sim.bothHeldMs > 0 && !sim.doorOpen) {
      const t = Math.min(1, sim.bothHeldMs / 800);
      g.rect(pe.x, pe.y - 8, pe.w * t, 4).fill({ color: 0xffdd88 });
      g.rect(pf.x, pf.y - 8, pf.w * t, 4).fill({ color: 0xaaddff });
    }
    g.rect(sim.level.exits.ember.x, sim.level.exits.ember.y, sim.level.exits.ember.w, sim.level.exits.ember.h).stroke({
      color: 0xff8844,
      width: 2,
      alpha: 0.8,
    });
    g.rect(sim.level.exits.frost.x, sim.level.exits.frost.y, sim.level.exits.frost.w, sim.level.exits.frost.h).stroke({
      color: 0x88ccff,
      width: 2,
      alpha: 0.8,
    });
    g.rect(sim.level.altar.x, sim.level.altar.y, sim.level.altar.w, sim.level.altar.h).fill({
      color: 0xc9a44c,
      alpha: 0.35,
    });

    this.doorA.clear();
    this.doorB.clear();
    if (!sim.doorOpen) {
      for (const [door, s] of [
        [this.doorA, sim.level.gatedSolids[0]],
        [this.doorB, sim.level.gatedSolids[1]],
      ] as const) {
        if (!s) continue;
        door.rect(s.x, s.y, s.w, s.h).fill({ color: 0x2a241c });
        door.rect(s.x, s.y, s.w, s.h).stroke({ color: 0xd4a24a, width: 2 });
      }
    } else {
      const t = Math.max(0, sim.latchMs / 5000);
      const s0 = sim.level.gatedSolids[0];
      if (s0) {
        this.doorA.rect(s0.x, s0.y - 10, s0.w, 6).fill({ color: 0xffcc66, alpha: t });
      }
    }

    // foot FX
    for (const a of [sim.ember, sim.frost]) {
      if (!a.onGround || Math.abs(a.vx) < 20) continue;
      const lava = sim.level.hazards.some((h) => h.type === "lava_shallow" && rectsOverlap(actorRect(a), h.rect));
      const water = sim.level.hazards.some((h) => h.type === "water_shallow" && rectsOverlap(actorRect(a), h.rect));
      const color = lava ? 0xffaa33 : water ? 0x88ddee : 0xc2b8a3;
      g.circle(a.x + a.w / 2, a.y + a.h, 6 + (sim.timeMs % 200) / 80).fill({ color, alpha: 0.25 });
    }
  }
}
