import { rectsOverlap, type Rect } from "../engine/aabb";
import type { ActorState, CrateState, Hazard, HoldGate, SimState } from "./types";

export function standingOnPlate(
  actor: Pick<ActorState, "x" | "y" | "w" | "h" | "downed" | "onGround">,
  plate: Rect,
): boolean {
  if (actor.downed || !actor.onGround) return false;
  const footX = actor.x + actor.w / 2;
  const footY = actor.y + actor.h;
  const inset = Math.min(10, plate.w * 0.12);
  return (
    footX >= plate.x + inset &&
    footX <= plate.x + plate.w - inset &&
    footY >= plate.y - 10 &&
    footY <= plate.y + plate.h + 10
  );
}

function holdGateOpen(sim: SimState, gate: HoldGate): boolean {
  if (gate.who === "ember" || gate.who === "any") {
    if (standingOnPlate(sim.ember, gate.plate)) return true;
  }
  if (gate.who === "frost" || gate.who === "any") {
    if (standingOnPlate(sim.frost, gate.plate)) return true;
  }
  return false;
}

export function crateRect(c: CrateState): Rect {
  return { x: c.x, y: c.y, w: c.w, h: c.h };
}

export function activeHazards(sim: SimState): Hazard[] {
  const list = [...sim.level.hazards];
  const tide = sim.level.tide;
  if (tide) {
    if (sim.tideLevel === 0) list.push(...tide.shallowWater);
    if (sim.tideLevel >= 1) list.push(...tide.midWater);
    if (sim.tideLevel === 2) {
      list.push(...tide.deepWater);
      list.push(...tide.flood);
    }
  }
  return list;
}

export function solidsNow(sim: SimState): Rect[] {
  const solids = [...sim.level.solids];
  if (!sim.doorOpen) solids.push(...sim.level.gatedSolids);
  if (sim.tideLevel === 1 && sim.level.tide) solids.push(...sim.level.tide.floatIce);
  for (const bridge of sim.level.bridges ?? []) {
    const rt = sim.bridges.find((b) => b.id === bridge.id);
    if (!rt?.collapsed) solids.push(bridge.rect);
  }
  solids.push(...sim.ashSolids);
  if (sim.level.phaseGates) {
    const lavaOpen = sim.phase === 0;
    for (const gate of sim.level.phaseGates) {
      const open = gate.side === "lava" ? lavaOpen : !lavaOpen;
      if (!open) solids.push(...gate.rects);
    }
  }
  if (sim.level.gear && sim.gearArmedMs !== null) {
    for (const win of sim.level.gear.windows) {
      const t = sim.gearArmedMs;
      const open = t >= win.openAtMs && t < win.closeAtMs;
      if (!open) solids.push(...win.solidsWhenClosed);
    }
  } else if (sim.level.gear) {
    for (const win of sim.level.gear.windows) solids.push(...win.solidsWhenClosed);
  }
  for (const gate of sim.level.holdGates ?? []) {
    if (!holdGateOpen(sim, gate)) solids.push(...gate.rects);
  }
  return solids;
}

export function onIce(sim: SimState, x: number, footY: number): boolean {
  const ice = sim.level.tide?.ice ?? [];
  const float = sim.tideLevel === 1 ? (sim.level.tide?.floatIce ?? []) : [];
  return [...ice, ...float].some(
    (s) => x >= s.x && x <= s.x + s.w && footY <= s.y + 18 && footY >= s.y - 8,
  );
}

export function applyOneWays(sim: SimState, actor: { x: number; y: number; w: number; h: number; vx: number }): void {
  for (const way of sim.level.oneWays ?? []) {
    if (!rectsOverlap({ x: actor.x, y: actor.y, w: actor.w, h: actor.h }, way.rect)) continue;
    if (way.dir > 0 && actor.vx < 0) actor.x = way.rect.x + way.rect.w;
    if (way.dir < 0 && actor.vx > 0) actor.x = way.rect.x - actor.w;
  }
}
