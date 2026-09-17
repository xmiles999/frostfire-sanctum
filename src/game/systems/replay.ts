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
import { activeHazards, solidsNow, standingOnPlate } from "../sim/world";

function cloneIntent(): Intent {
  return { ...EMPTY_INTENT };
}

function cxOf(actor: ActorState): number {
  return actor.x + actor.w / 2;
}

function hasSupport(solids: Rect[], x: number, footY: number, slack = 16): boolean {
  return solids.some((s) => x >= s.x && x <= s.x + s.w && footY <= s.y + slack && footY >= s.y - 6);
}

function hazardAhead(sim: SimState, actor: ActorState, dir: 1 | -1, targetX: number): boolean {
  const cx = cxOf(actor);
  const footY = actor.y + actor.h;
  const probe: Rect = {
    x: dir > 0 ? cx + 10 : cx - 80,
    y: footY - 16,
    w: 70,
    h: 20,
  };
  for (const h of activeHazards(sim)) {
    if (!rectsOverlap(probe, h.rect)) continue;
    if (dir > 0 && h.rect.x > targetX + 12) continue;
    if (dir < 0 && h.rect.x + h.rect.w < targetX - 12) continue;
    if (actor.id === "frost" && (h.type === "lava_shallow" || h.type === "lava_deep")) return true;
    if (actor.id === "ember" && (h.type === "water_shallow" || h.type === "water_deep" || h.type === "ice_mist"))
      return true;
  }
  return false;
}

function shouldJump(sim: SimState, actor: ActorState, targetX: number): boolean {
  if (!actor.onGround) return false;
  const cx = cxOf(actor);
  if (Math.abs(targetX - cx) < 18) return false;
  const dir = (targetX > cx ? 1 : -1) as 1 | -1;
  const footY = actor.y + actor.h;
  const look = cx + dir * 42;
  if (hazardAhead(sim, actor, dir, targetX)) return true;
  const solids = solidsNow(sim);

  const ledgeUp = solids.some((s) => {
    const lift = footY - s.y;
    const ahead = dir > 0 ? s.x : s.x + s.w;
    const dist = (ahead - cx) * dir;
    return dist > 8 && dist < 1.7 * TILE && lift > 28 && lift < 165;
  });
  if (ledgeUp) return true;

  if (hasSupport(solids, look, footY)) return false;
  for (let d = 48; d <= 4.2 * TILE; d += 10) {
    if (hasSupport(solids, look + dir * d, footY, 20)) return true;
  }
  return false;
}

function goWalk(intent: Intent, actor: ActorState, targetX: number): void {
  const cx = cxOf(actor);
  if (cx < targetX - 5) intent.right = true;
  else if (cx > targetX + 5) intent.left = true;
}

function goX(intent: Intent, sim: SimState, actor: ActorState, targetX: number): void {
  goWalk(intent, actor, targetX);
  const cx = cxOf(actor);
  const toward = (targetX > cx && intent.right) || (targetX < cx && intent.left);
  const holdArc = !actor.onGround && toward;
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
  const cx = cxOf(actor);
  if (cx > waitX + 28) {
    goWalk(intent, actor, targetX);
    return;
  }
  if (cx <= waitX + 20 && !(steam.phase === "safe" && steam.remainMs > 1100)) {
    goX(intent, sim, actor, waitX);
    return;
  }
  goWalk(intent, actor, targetX);
}

function holdGateHeld(sim: SimState, index: number): boolean {
  const gate = sim.level.holdGates?.[index];
  if (!gate) return true;
  if (gate.who === "ember" || gate.who === "any") {
    if (standingOnPlate(sim.ember, gate.plate)) return true;
  }
  if (gate.who === "frost" || gate.who === "any") {
    if (standingOnPlate(sim.frost, gate.plate)) return true;
  }
  return false;
}

function goFrost01(intent: Intent, sim: SimState, targetX: number): void {
  goX(intent, sim, sim.frost, targetX);
}

function official01(sim: SimState): PairIntent {
  const ember = cloneIntent();
  const frost = cloneIntent();
  const wispOnEmber = sim.wisp.phase === "chase" && sim.wisp.target === "ember";
  const frostCx = cxOf(sim.frost);
  const frostPastGate = frostCx > L01.frostPastGateX;

  if (sim.doorOpen) {
    goX(ember, sim, sim.ember, L01.exitEmberX);
    goFrost01(frost, sim, L01.exitFrostX);
    return { ember, frost };
  }

  if (sim.plateEmber && sim.plateFrost) return { ember, frost };

  if (frostPastGate && cxOf(sim.ember) > 16.4 * TILE) {
    goX(ember, sim, sim.ember, L01.plateEmberX);
    goFrost01(frost, sim, L01.plateFrostX);
    return { ember, frost };
  }

  if (frostPastGate) {
    goX(ember, sim, sim.ember, L01.plateEmberX);
    steamAdvance(frost, sim, sim.frost, L01.steamWaitX, L01.plateFrostX);
    return { ember, frost };
  }

  if (!wispOnEmber) {
    goX(ember, sim, sim.ember, L01.lureX);
    goFrost01(frost, sim, L01.frostWaitX);
    return { ember, frost };
  }

  goX(ember, sim, sim.ember, L01.holdEmberX);
  if (holdGateHeld(sim, 0)) steamAdvance(frost, sim, sim.frost, L01.steamWaitX, L01.plateFrostX);
  else goFrost01(frost, sim, L01.frostWaitX);
  return { ember, frost };
}

function official02(sim: SimState): PairIntent {
  const ember = cloneIntent();
  const frost = cloneIntent();
  const crate = sim.crates[0];
  const crateX = crate ? crate.x + crate.w / 2 : 0;
  const wellReady = crateX >= 9.0 * TILE;
  const seated =
    crate && sim.level.tide
      ? crateX > 10.2 * TILE && crateX < 13.6 * TILE && sim.tideLevel === 2
      : false;
  const frostPastHold = cxOf(sim.frost) > 17.0 * TILE;

  if (sim.doorOpen && sim.tideLevel === 1) {
    if (!frostPastHold && !holdGateHeld(sim, 0)) {
      goX(ember, sim, sim.ember, L02.holdEmberX);
      goWalk(frost, sim.frost, 15.2 * TILE);
      return { ember, frost };
    }
    if (!frostPastHold) {
      goX(ember, sim, sim.ember, L02.holdEmberX);
      goWalk(frost, sim.frost, L02.plateFrostX);
      return { ember, frost };
    }
    goX(ember, sim, sim.ember, L02.exitEmberX);
    goX(frost, sim, sim.frost, L02.exitFrostX);
    return { ember, frost };
  }

  if (sim.tideLevel === 2) {
    if (sim.doorOpen) {
      const onLever = Math.abs(cxOf(sim.ember) - L02.leverX) < 42;
      goX(ember, sim, sim.ember, onLever ? L02.waitLeverX : L02.leverX);
    } else {
      goX(ember, sim, sim.ember, L02.waitLeverX);
    }
    goWalk(frost, sim.frost, seated || sim.doorOpen ? 12.2 * TILE : L02.wellX);
    return { ember, frost };
  }

  if (!wellReady) goX(ember, sim, sim.ember, L02.waitLeverX);
  else goX(ember, sim, sim.ember, L02.leverX);
  if (!wellReady) goWalk(frost, sim.frost, crate ? crate.x + crate.w + 28 : L02.wellEdgeX);
  else goWalk(frost, sim.frost, L02.wellEdgeX - 6);
  return { ember, frost };
}

function official03(sim: SimState): PairIntent {
  const ember = cloneIntent();
  const frost = cloneIntent();
  const mid = sim.bridges.find((b) => b.id === "wood_mid");
  const frostPast = cxOf(sim.frost) > 14.2 * TILE;
  const frostPastHold = cxOf(sim.frost) > 16.4 * TILE;
  const pastDoor = sim.doorOpen || sim.ember.x > 20.2 * TILE;

  if (pastDoor) {
    goX(ember, sim, sim.ember, L03.exitEmberX);
    goX(frost, sim, sim.frost, L03.exitFrostX);
    return { ember, frost };
  }

  if (sim.plateEmber && sim.plateFrost) return { ember, frost };

  if (mid?.collapsed) {
    if (!frostPastHold && !holdGateHeld(sim, 0)) {
      goX(ember, sim, sim.ember, L03.holdEmberX);
      goX(frost, sim, sim.frost, 14.6 * TILE);
      return { ember, frost };
    }
    if (!frostPastHold) {
      goX(ember, sim, sim.ember, L03.holdEmberX);
      goX(frost, sim, sim.frost, L03.plateFrostX);
      return { ember, frost };
    }
    goX(ember, sim, sim.ember, L03.plateEmberX);
    goX(frost, sim, sim.frost, L03.plateFrostX);
    return { ember, frost };
  }

  if (!frostPast) {
    goX(frost, sim, sim.frost, 14.6 * TILE);
    goX(ember, sim, sim.ember, 6.4 * TILE);
    return { ember, frost };
  }

  goX(frost, sim, sim.frost, 14.6 * TILE);
  goX(ember, sim, sim.ember, L03.igniteX);
  if (Math.abs(cxOf(sim.ember) - L03.igniteX) < 50) pulseInteract(ember, sim.ember);
  return { ember, frost };
}

function official04(sim: SimState): PairIntent {
  const ember = cloneIntent();
  const frost = cloneIntent();
  const wispOnEmber = sim.wisp.phase === "chase" && sim.wisp.target === "ember";
  const pastDoor = sim.doorOpen || sim.ember.x > 20.2 * TILE;
  const frostPastHold = cxOf(sim.frost) > 16.2 * TILE;

  if (pastDoor) {
    goX(ember, sim, sim.ember, L04.exitEmberX);
    goX(frost, sim, sim.frost, L04.exitFrostX);
    return { ember, frost };
  }

  if (sim.plateEmber && sim.plateFrost) return { ember, frost };

  if (cxOf(sim.ember) > 12.4 * TILE && cxOf(sim.frost) > 12.4 * TILE) {
    if (!frostPastHold && !holdGateHeld(sim, 0)) {
      goX(ember, sim, sim.ember, L04.holdEmberX);
      steamAdvance(frost, sim, sim.frost, 14.4 * TILE, 14.8 * TILE);
      return { ember, frost };
    }
    if (!frostPastHold) {
      goX(ember, sim, sim.ember, L04.holdEmberX);
      steamAdvance(frost, sim, sim.frost, 14.4 * TILE, L04.plateFrostX);
      return { ember, frost };
    }
    goX(ember, sim, sim.ember, L04.plateEmberX);
    steamAdvance(frost, sim, sim.frost, 14.4 * TILE, L04.plateFrostX);
    return { ember, frost };
  }

  if (sim.frost.x < 8.2 * TILE) {
    goX(ember, sim, sim.ember, 9.6 * TILE);
    if (!wispOnEmber) goX(frost, sim, sim.frost, 2.4 * TILE);
    else goX(frost, sim, sim.frost, L04.innerFrostX);
    return { ember, frost };
  }

  if (sim.phase === 1 && sim.frost.x < 13.2 * TILE) {
    goX(frost, sim, sim.frost, L04.innerFrostX);
    goX(ember, sim, sim.ember, 11.2 * TILE);
    return { ember, frost };
  }

  if (sim.phaseLockMs > 0 || sim.phase === 0) {
    goX(ember, sim, sim.ember, L04.innerEmberX);
    if (sim.phase === 0 && sim.phaseLockMs === 0 && cxOf(sim.ember) > 12.8 * TILE) {
      goX(ember, sim, sim.ember, L04.holdEmberX);
      steamAdvance(frost, sim, sim.frost, 14.4 * TILE, L04.plateFrostX);
      return { ember, frost };
    }
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
  const pastDoor = sim.doorOpen || sim.ember.x > 20.2 * TILE;
  const frostPastHold = cxOf(sim.frost) > 16.2 * TILE;

  if (pastDoor) {
    goX(ember, sim, sim.ember, L05.exitEmberX);
    goX(frost, sim, sim.frost, L05.exitFrostX);
    return { ember, frost };
  }

  if (sim.plateEmber && sim.plateFrost) return { ember, frost };

  if (armed === null) {
    goX(ember, sim, sim.ember, L05.leverX);
    if (Math.abs(cxOf(sim.ember) - L05.leverX) < 36) pulseInteract(ember, sim.ember);
    goX(frost, sim, sim.frost, 3.2 * TILE);
    return { ember, frost };
  }

  if (armed < 1400) {
    goX(ember, sim, sim.ember, L05.holdEmberX);
    goX(frost, sim, sim.frost, 3.2 * TILE);
    return { ember, frost };
  }

  if (armed < 3000) {
    goX(ember, sim, sim.ember, L05.holdEmberX);
    goX(frost, sim, sim.frost, L05.frostChamberX);
    return { ember, frost };
  }

  if (armed < 3600) {
    goX(ember, sim, sim.ember, L05.holdEmberX);
    goX(frost, sim, sim.frost, L05.frostChamberX);
    return { ember, frost };
  }

  if (!frostPastHold && !holdGateHeld(sim, 0)) {
    goX(ember, sim, sim.ember, L05.holdEmberX);
    goX(frost, sim, sim.frost, 14.4 * TILE);
    return { ember, frost };
  }
  if (!frostPastHold) {
    goX(ember, sim, sim.ember, L05.holdEmberX);
    goX(frost, sim, sim.frost, L05.plateFrostX);
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
  goX(frost, sim, sim.frost, 14 * TILE);
  return { ember, frost };
}
