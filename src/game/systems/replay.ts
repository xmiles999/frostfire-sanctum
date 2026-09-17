import { rectsOverlap, type Rect } from "../engine/aabb";
import { TILE } from "../engine/constants";
import { L01 } from "../levels/level01";
import { L02 } from "../levels/level02";
import { L03 } from "../levels/level03";
import { L04 } from "../levels/level04";
import { L05 } from "../levels/level05";
import { steamAt } from "../sim/steam";
import type { ActorState, Intent, PairIntent, SimState } from "../sim/types";
import { EMPTY_INTENT } from "../sim/types";
import { activeHazards, solidsNow } from "../sim/world";

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
  for (const h of activeHazards(sim)) {
    if (!rectsOverlap(probe, h.rect)) continue;
    if (actor.id === "frost" && (h.type === "lava_shallow" || h.type === "lava_deep")) return true;
    if (actor.id === "ember" && (h.type === "water_shallow" || h.type === "water_deep" || h.type === "ice_mist"))
      return true;
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
  const solids = solidsNow(sim);

  const ledgeUp = solids.some((s) => {
    const lift = footY - s.y;
    const ahead = dir > 0 ? s.x : s.x + s.w;
    const dist = (ahead - cx) * dir;
    return dist > 8 && dist < 1.7 * TILE && lift > 28 && lift < 130;
  });
  if (ledgeUp) return true;

  if (hasSupport(solids, look, footY)) return false;
  for (let d = 48; d <= 4.2 * TILE; d += 10) {
    if (hasSupport(solids, look + dir * d, footY, 20)) return true;
  }
  return false;
}

function goWalk(intent: Intent, actor: ActorState, targetX: number): void {
  const cx = actor.x + actor.w / 2;
  if (cx < targetX - 5) intent.right = true;
  else if (cx > targetX + 5) intent.left = true;
}

function goX(intent: Intent, sim: SimState, actor: ActorState, targetX: number): void {
  goWalk(intent, actor, targetX);
  const cx = actor.x + actor.w / 2;
  const toward = (targetX > cx && intent.right) || (targetX < cx && intent.left);
  const holdArc = !actor.onGround && actor.vy < -40 && toward;
  if (shouldJump(sim, actor, targetX) || holdArc) {
    intent.jump = true;
    intent.up = true;
  }
}

function pulseInteract(intent: Intent, actor: ActorState): void {
  if (!actor.interactHeld) intent.interact = true;
}

function steamAdvance(
  intent: Intent,
  sim: SimState,
  actor: ActorState,
  waitX: number,
  targetX: number,
): void {
  const steam = steamAt(sim.timeMs);
  const cx = actor.x + actor.w / 2;
  if (cx > waitX + 6 && cx < targetX && steam.phase !== "safe") {
    goWalk(intent, actor, waitX);
    return;
  }
  if (cx <= waitX + 20 && !(steam.phase === "safe" && steam.remainMs > 1100)) {
    goWalk(intent, actor, waitX);
    return;
  }
  goWalk(intent, actor, targetX);
}

function official01(sim: SimState): PairIntent {
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

  if (frostPastSteam || frostClearWisp) goX(ember, sim, sim.ember, L01.plateEmberX);
  else goX(ember, sim, sim.ember, L01.lureX);

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
  if (inCurtain && steam.phase !== "safe") goX(frost, sim, sim.frost, waitX);
  else if (!committed && !(steam.phase === "safe" && steam.remainMs > 1000)) goX(frost, sim, sim.frost, waitX);
  else goX(frost, sim, sim.frost, 47 * TILE);

  return { ember, frost };
}

function official02(sim: SimState): PairIntent {
  const ember = cloneIntent();
  const frost = cloneIntent();
  const crate = sim.crates[0];
  const crateX = crate ? crate.x + crate.w / 2 : 0;
  const wellReady = crateX >= 36.5 * TILE;
  const seated =
    crate && sim.level.tide
      ? crate.x + crate.w / 2 > 41 * TILE && crate.x + crate.w / 2 < 45 * TILE && sim.tideLevel === 2
      : false;

  if (sim.doorOpen && sim.tideLevel === 1) {
    goX(ember, sim, sim.ember, L02.exitEmberX);
    goX(frost, sim, sim.frost, L02.exitFrostX);
    return { ember, frost };
  }

  if (sim.tideLevel === 2) {
    goX(ember, sim, sim.ember, 18 * TILE);
    if (seated && Math.abs(sim.ember.x + sim.ember.w / 2 - L02.leverX) < 48) pulseInteract(ember, sim.ember);
    goX(frost, sim, sim.frost, seated ? 44 * TILE : L02.wellX);
    return { ember, frost };
  }

  goX(ember, sim, sim.ember, L02.leverX);
  if (wellReady && Math.abs(sim.ember.x + sim.ember.w / 2 - L02.leverX) < 48) pulseInteract(ember, sim.ember);
  if (!wellReady) goX(frost, sim, sim.frost, crate ? crate.x + crate.w + 36 : L02.wellEdgeX);
  else goX(frost, sim, sim.frost, L02.wellEdgeX - 8);
  return { ember, frost };
}

function official03(sim: SimState): PairIntent {
  const ember = cloneIntent();
  const frost = cloneIntent();
  const mid = sim.bridges.find((b) => b.id === "wood_mid");
  const frostPast = sim.frost.x + sim.frost.w / 2 > 24 * TILE;
  const pastDoor = sim.doorOpen || sim.ember.x > 56.2 * TILE;

  if (pastDoor) {
    goX(ember, sim, sim.ember, L03.exitEmberX);
    goX(frost, sim, sim.frost, L03.exitFrostX);
    return { ember, frost };
  }

  if (mid?.collapsed) {
    goX(ember, sim, sim.ember, L03.plateEmberX);
    goX(frost, sim, sim.frost, L03.plateFrostX);
    return { ember, frost };
  }

  if (!frostPast) {
    goX(frost, sim, sim.frost, 24.5 * TILE);
    goX(ember, sim, sim.ember, 10 * TILE);
    return { ember, frost };
  }

  goX(frost, sim, sim.frost, 24.5 * TILE);
  goX(ember, sim, sim.ember, L03.igniteX);
  if (Math.abs(sim.ember.x + sim.ember.w / 2 - L03.igniteX) < 50) pulseInteract(ember, sim.ember);
  return { ember, frost };
}

function official04(sim: SimState): PairIntent {
  const ember = cloneIntent();
  const frost = cloneIntent();
  const wispOnEmber = sim.wisp.phase === "chase" && sim.wisp.target === "ember";
  const pastDoor = sim.doorOpen || sim.ember.x > 56.2 * TILE;

  if (pastDoor) {
    goX(ember, sim, sim.ember, L04.exitEmberX);
    goX(frost, sim, sim.frost, L04.exitFrostX);
    return { ember, frost };
  }

  if (sim.plateEmber && sim.plateFrost) return { ember, frost };

  if (sim.ember.x > 34 * TILE && sim.frost.x > 34 * TILE && sim.phase === 1) {
    goX(ember, sim, sim.ember, L04.plateEmberX);
    steamAdvance(frost, sim, sim.frost, 42.5 * TILE, L04.plateFrostX);
    return { ember, frost };
  }

  if (sim.frost.x < 20 * TILE) {
    goX(ember, sim, sim.ember, 16.4 * TILE);
    if (!wispOnEmber) goX(frost, sim, sim.frost, 8 * TILE);
    else goX(frost, sim, sim.frost, L04.innerFrostX);
    return { ember, frost };
  }

  if (sim.phase === 1 && sim.frost.x < 34 * TILE) {
    goX(frost, sim, sim.frost, L04.innerFrostX);
    goX(ember, sim, sim.ember, 29 * TILE);
    return { ember, frost };
  }

  if (sim.phase === 0 || sim.phaseLockMs > 0) {
    goX(ember, sim, sim.ember, L04.innerEmberX);
    goX(frost, sim, sim.frost, L04.innerFrostX);
    return { ember, frost };
  }

  goX(ember, sim, sim.ember, L04.innerEmberX);
  goX(frost, sim, sim.frost, L04.innerFrostX);
  return { ember, frost };
}

function official05(sim: SimState): PairIntent {
  const ember = cloneIntent();
  const frost = cloneIntent();
  const armed = sim.gearArmedMs;
  const pastDoor = sim.doorOpen || sim.ember.x > 56.2 * TILE;

  if (pastDoor) {
    goX(ember, sim, sim.ember, L05.exitEmberX);
    goX(frost, sim, sim.frost, L05.exitFrostX);
    return { ember, frost };
  }

  if (armed === null) {
    goX(ember, sim, sim.ember, L05.leverX);
    if (Math.abs(sim.ember.x + sim.ember.w / 2 - L05.leverX) < 36) pulseInteract(ember, sim.ember);
    goX(frost, sim, sim.frost, 8 * TILE);
    return { ember, frost };
  }

  if (armed < 2200) {
    goX(ember, sim, sim.ember, 28 * TILE);
    goX(frost, sim, sim.frost, 8 * TILE);
    return { ember, frost };
  }

  if (armed < 1400) {
    goX(ember, sim, sim.ember, L05.plateEmberX);
    goX(frost, sim, sim.frost, 8 * TILE);
    return { ember, frost };
  }

  if (armed < 3600) {
    goX(ember, sim, sim.ember, L05.plateEmberX);
    goX(frost, sim, sim.frost, 26 * TILE);
    return { ember, frost };
  }

  goX(ember, sim, sim.ember, L05.plateEmberX);
  goX(frost, sim, sim.frost, L05.plateFrostX);
  return { ember, frost };
}

export function officialPolicy(sim: SimState): PairIntent {
  if (sim.level.id === "02") return official02(sim);
  if (sim.level.id === "03") return official03(sim);
  if (sim.level.id === "04") return official04(sim);
  if (sim.level.id === "05") return official05(sim);
  return official01(sim);
}

export function frostRushesWispPolicy(sim: SimState): PairIntent {
  const ember = cloneIntent();
  const frost = cloneIntent();
  goX(frost, sim, sim.frost, 32 * TILE);
  return { ember, frost };
}
