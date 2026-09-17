import { MAX_PHYS_STEPS, PHYS_DT } from "./engine/constants";
import { InputMap } from "./engine/input";
import { createSim } from "./sim/create";
import { starsFor, stepSim } from "./sim/step";
import type { PairIntent, SimState } from "./sim/types";
import { LEVEL_01 } from "./levels/level01";
import { levelById } from "./levels/catalog";
import type { LevelDocument } from "./sim/types";
import { GameView } from "./view/GameView";
import { recordClear } from "./systems/save";
import { officialPolicy } from "./systems/replay";
import { EMPTY_INTENT } from "./sim/types";

export interface HudModel {
  timeMs: number;
  deaths: number;
  steamPhase: string;
  doorOpen: boolean;
  doorPhase: SimState["doorPhase"];
  latchMs: number;
  plateEmber: boolean;
  plateFrost: boolean;
  rescueMs: number;
  status: SimState["status"];
  separated: boolean;
  stars: number;
  title: string;
  puzzleHint: string;
  levelId: string;
}

export class GameRuntime {
  level: LevelDocument = LEVEL_01;
  sim: SimState = createSim(LEVEL_01);
  input = new InputMap();
  view: GameView | null = null;
  private acc = 0;
  private last = 0;
  private raf = 0;
  demo = false;
  onHud?: (hud: HudModel) => void;
  private recordedClear = false;

  load(id: string): void {
    this.level = levelById(id);
    this.restart();
  }

  restart(): void {
    this.sim = createSim(this.level);
    this.acc = 0;
    this.recordedClear = false;
    this.view?.resetWorld();
  }

  pause(): void {
    if (this.sim.status === "playing" || this.sim.status === "rescue_window") {
      this.sim.status = "paused";
    }
  }

  resume(): void {
    if (this.sim.status === "paused") this.sim.status = "playing";
  }

  attach(view: GameView): void {
    this.view = view;
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.tick(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  detach(): void {
    cancelAnimationFrame(this.raf);
    this.view?.destroy();
    this.view = null;
  }

  private tick(dt: number): void {
    if (this.sim.status !== "paused" && this.sim.status !== "failed" && this.sim.status !== "cleared") {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= PHYS_DT && steps < MAX_PHYS_STEPS) {
        const intents: PairIntent = this.demo ? officialPolicy(this.sim) : this.input.pair();
        stepSim(this.sim, intents, PHYS_DT);
        this.acc -= PHYS_DT;
        steps += 1;
      }
    }
    if (this.sim.status === "cleared" && !this.recordedClear) {
      this.recordedClear = true;
      recordClear(this.sim.level.id, starsFor(this.sim), this.sim.timeMs, this.sim.deaths);
    }
    this.view?.render(this.sim, dt);
    this.onHud?.({
      timeMs: this.sim.timeMs,
      deaths: this.sim.deaths,
      steamPhase: this.sim.steamPhase,
      doorOpen: this.sim.doorOpen,
      doorPhase: this.sim.doorPhase,
      latchMs: this.sim.latchMs,
      plateEmber: this.sim.plateEmber,
      plateFrost: this.sim.plateFrost,
      rescueMs: this.sim.rescueMs,
      status: this.sim.status,
      separated: Math.abs(this.sim.ember.x - this.sim.frost.x) > 28 * 48,
      stars: starsFor(this.sim),
      title: this.sim.level.title,
      puzzleHint: this.sim.puzzleHint,
      levelId: this.sim.level.id,
    });
  }
}

export const idlePair = (): PairIntent => ({ ember: { ...EMPTY_INTENT }, frost: { ...EMPTY_INTENT } });
