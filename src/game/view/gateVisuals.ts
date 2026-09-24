import type { Rect } from "../engine/aabb";
import { DOOR_MOTION_MS } from "../engine/constants";
import type { SimState } from "../sim/types";

export const GATE_STYLE = {
  track: 0x30363a,
  edge: 0xb0a89c,
  cap: 0x6f675b,
  recess: 0x22282a,
  highlight: 0xe0d8c3,
  brass: 0xb39b6d,
  worn: 0x8c8172,
} as const;

const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const easeGate = (n: number): number => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};

/** The timed latch owns its animation clock; rendering never delays collision changes. */
export function doorOpenAmount(
  sim: Pick<SimState, "doorPhase" | "doorMotionMs" | "doorOpen">,
  reducedMotion = false,
): number {
  if (reducedMotion) return sim.doorOpen ? 1 : 0;
  if (sim.doorPhase === "open") return 1;
  if (sim.doorPhase === "opening") return easeGate(1 - sim.doorMotionMs / DOOR_MOTION_MS);
  if (sim.doorPhase === "closing") return easeGate(sim.doorMotionMs / DOOR_MOTION_MS);
  return 0;
}

/** Untimed partner/phase/gear gates share a short, reversible simulation-clock transition. */
export class GateMotion {
  private states = new Map<string, { from: number; to: number; at: number }>();

  clear(): void {
    this.states.clear();
  }

  sample(key: string, open: boolean, timeMs: number, reducedMotion = false): number {
    const to = open ? 1 : 0;
    let state = this.states.get(key);
    if (!state || reducedMotion || timeMs < state.at) {
      this.states.set(key, { from: to, to, at: timeMs });
      return to;
    }
    const value = state.from + (state.to - state.from) * easeGate((timeMs - state.at) / 160);
    if (state.to !== to) {
      state = { from: value, to, at: timeMs };
      this.states.set(key, state);
    }
    return value;
  }
}

/** Two leaves retract inside the original frame, never through neighbouring floors. */
export function gateLeaves(rect: Rect, openAmount: number): Rect[] {
  const height = rect.h * 0.5 * (1 - clamp(openAmount));
  if (height <= 0) return [];
  return [
    { x: rect.x + 3, y: rect.y, w: Math.max(1, rect.w - 6), h: height },
    { x: rect.x + 3, y: rect.y + rect.h - height, w: Math.max(1, rect.w - 6), h: height },
  ];
}

/** Translate, then clip each rung: no texture squashing or bars popping outside the frame. */
export function gateRungs(rect: Rect, openAmount: number): Rect[] {
  const leaves = gateLeaves(rect, openAmount);
  const offset = rect.h * 0.5 * clamp(openAmount);
  return leaves.flatMap((leaf, index) => {
    const rungs: Rect[] = [];
    for (let y = rect.y + index * rect.h * 0.5 + 8; y < rect.y + (index + 1) * rect.h * 0.5; y += 18) {
      const top = Math.max(leaf.y, y + (index === 0 ? -offset : offset));
      const bottom = Math.min(leaf.y + leaf.h, y + (index === 0 ? -offset : offset) + 2);
      if (bottom > top) rungs.push({ x: leaf.x, y: top, w: leaf.w, h: bottom - top });
    }
    return rungs;
  });
}
