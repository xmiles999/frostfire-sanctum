import { rectsOverlap, type Rect } from "../engine/aabb";
import { TILE } from "../engine/constants";
import { L01 } from "../levels/level01";
import { steamAt } from "../sim/steam";
import type { ActorState, Intent, PairIntent, SimState } from "../sim/types";
import { EMPTY_INTENT } from "../sim/types";

function cloneIntent(): Intent {
  return { ...EMPTY_INTENT };
}

function hasSupport(solids: Rect[], x: number, footY: number, slack = 16): boolean {
  return solids.some((s) => x >= s.x && x <= s.x + s.w && footY <= s.y + slack && footY >= s.y - 6);
}

function hazardAhead(sim: SimState, actor: ActorState, dir: 1 | -1): boolean {
  const cx = actor.x + actor.w / 2;
  const footY = actor.y + actor.h;
  const probe: Rect = {
    x: dir > 0 ? cx + 10 : cx - 80,
    y: footY - 16,
    w: 70,
    h: 20,
  };
  for (const h of sim.level.hazards) {
    if (!rectsOverlap(probe, h.rect)) continue;
    if (actor.id === "frost" && h.type === "lava_shallow") return true;
    if (actor.id === "ember" && (h.type === "water_shallow" || h.type === "ice_mist")) return true;
  }
  return false;
}

function shouldJump(sim: SimState, actor: ActorState, targetX: number): boolean {
  if (!actor.onGround) return false;
  const cx = actor.x + actor.w / 2;
  if (Math.abs(targetX - cx) < 18) return false;
  const dir = (targetX > cx ? 1 : -1) as 1 | -1;
  const footY = actor.y + actor.h;
  const look = cx + dir * 42;
  if (hazardAhead(sim, actor, dir)) return true;

  const ledgeUp = sim.level.solids.some((s) => {
    const lift = footY - s.y;
    const ahead = dir > 0 ? s.x : s.x + s.w;
    const dist = (ahead - cx) * dir;
    return dist > 8 && dist < 1.7 * TILE && lift > 28 && lift < 130;
  });
  if (ledgeUp) return true;

  if (hasSupport(sim.level.solids, look, footY)) return false;
  for (let d = 48; d <= 4.2 * TILE; d += 10) {
    if (hasSupport(sim.level.solids, look + dir * d, footY, 20)) return true;
  }
  return false;
}

function goX(intent: Intent, sim: SimState, actor: ActorState, targetX: number): void {
  const cx = actor.x + actor.w / 2;
  if (cx < targetX - 5) intent.right = true;
  else if (cx > targetX + 5) intent.left = true;
  const toward = (targetX > cx && intent.right) || (targetX < cx && intent.left);
  const holdArc = !actor.onGround && actor.vy < -40 && toward;
  if (shouldJump(sim, actor, targetX) || holdArc) {
    intent.jump = true;
    intent.up = true;
  }
}

export function officialPolicy(sim: SimState): PairIntent {
  const ember = cloneIntent();
  const frost = cloneIntent();
  const steam = steamAt(sim.timeMs);
  const wispOnEmber = sim.wisp.phase === "chase" && sim.wisp.target === "ember";
  const frostClearWisp = sim.frost.x + sim.frost.w / 2 > 36 * TILE;
  const frostPastSteam = sim.frost.x + sim.frost.w / 2 > 46 * TILE;

  const pastDoor = sim.ember.x > 56.2 * TILE || sim.frost.x > 56.2 * TILE;
  if (sim.doorOpen || pastDoor) {
    goX(ember, sim, sim.ember, L01.exitEmberX);
    goX(frost, sim, sim.frost, L01.exitFrostX);
    return { ember, frost };
  }

  if (frostPastSteam || frostClearWisp) {
    goX(ember, sim, sim.ember, L01.plateEmberX);
  } else {
    goX(ember, sim, sim.ember, L01.lureX);
  }

  if (frostPastSteam) {
    goX(frost, sim, sim.frost, L01.plateFrostX);
    return { ember, frost };
  }

  if (!wispOnEmber && !frostClearWisp) {
    goX(frost, sim, sim.frost, 8 * TILE);
    return { ember, frost };
  }

  const frostCx = sim.frost.x + sim.frost.w / 2;
  const waitX = 40.2 * TILE;
  const inCurtain = frostCx > 41.6 * TILE && frostCx < 46 * TILE;
  const committed = frostCx >= waitX + 8;
  if (inCurtain && steam.phase !== "safe") {
    goX(frost, sim, sim.frost, waitX);
  } else if (!committed && !(steam.phase === "safe" && steam.remainMs > 1000)) {
    goX(frost, sim, sim.frost, waitX);
  } else {
    goX(frost, sim, sim.frost, 47 * TILE);
  }

  return { ember, frost };
}

/** Suicide path: frost sprints the wisp corridor immediately. */
export function frostRushesWispPolicy(sim: SimState): PairIntent {
  const ember = cloneIntent();
  const frost = cloneIntent();
  goX(frost, sim, sim.frost, 32 * TILE);
  return { ember, frost };
}
