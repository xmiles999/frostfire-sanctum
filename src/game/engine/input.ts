import type { Intent, PairIntent } from "../sim/types";
import { EMPTY_INTENT } from "../sim/types";

export interface Bindings {
  ember: { left: string; right: string; up: string; down: string; interact: string };
  frost: { left: string; right: string; up: string; down: string; interact: string };
  pause: string;
  restart: string;
}

export const DEFAULT_BINDINGS: Bindings = {
  ember: {
    left: "KeyA",
    right: "KeyD",
    up: "KeyW",
    down: "KeyS",
    interact: "KeyJ",
  },
  frost: {
    left: "ArrowLeft",
    right: "ArrowRight",
    up: "ArrowUp",
    down: "ArrowDown",
    interact: "Semicolon",
  },
  pause: "Escape",
  restart: "KeyR",
};

export class InputMap {
  readonly keys = new Set<string>();
  bindings: Bindings;
  restartHeldMs = 0;

  constructor(bindings: Bindings = DEFAULT_BINDINGS) {
    this.bindings = bindings;
  }

  down(code: string): void {
    this.keys.add(code);
  }

  up(code: string): void {
    this.keys.delete(code);
  }

  private held(code: string): boolean {
    return this.keys.has(code);
  }

  pair(): PairIntent {
    const e = this.bindings.ember;
    const f = this.bindings.frost;
    const ember: Intent = {
      ...EMPTY_INTENT,
      left: this.held(e.left),
      right: this.held(e.right),
      up: this.held(e.up),
      down: this.held(e.down),
      interact: this.held(e.interact),
      jump: this.held(e.up),
    };
    const frost: Intent = {
      ...EMPTY_INTENT,
      left: this.held(f.left),
      right: this.held(f.right),
      up: this.held(f.up),
      down: this.held(f.down),
      interact: this.held(f.interact),
      jump: this.held(f.up),
    };
    return { ember, frost };
  }

  pausePressed(code: string): boolean {
    return code === this.bindings.pause;
  }
}
