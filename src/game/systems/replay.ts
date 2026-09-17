import { TILE } from "../engine/constants";
import { L01 } from "../levels/level01";
import { steamAt } from "../sim/steam";
import type { ActorState, Intent, PairIntent, SimState } from "../sim/types";
import { EMPTY_INTENT } from "../sim/types";

function cloneIntent(): Intent {
  return { ...EMPTY_INTENT };
}

function goX(intent: Intent, actor: ActorState, targetX: number, jumpGap: boolean): void {
  const cx = actor.x + actor.w / 2;
  if (cx < targetX - 5) intent.right = true;
  else if (cx > targetX + 5) intent.left = true;
  if (jumpGap && actor.onGround && cx > 5.2 * TILE && cx < 8 * TILE && targetX > 10 * TILE) {
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
  const frostPastSteam = sim.frost.x + sim.frost.w / 2 > 45 * TILE;

  const pastDoor = sim.ember.x > 56.2 * TILE || sim.frost.x > 56.2 * TILE;
  if (sim.doorOpen || pastDoor) {
    goX(ember, sim.ember, L01.exitEmberX, true);
    goX(frost, sim.frost, L01.exitFrostX, false);
    return { ember, frost };
  }

  if (frostPastSteam || frostClearWisp) {
    goX(ember, sim.ember, L01.plateEmberX, true);
  } else {
    goX(ember, sim.ember, L01.lureX, true);
  }

  if (frostPastSteam) {
    goX(frost, sim.frost, L01.plateFrostX, false);
    return { ember, frost };
  }

  if (!wispOnEmber && !frostClearWisp) {
    // frost waits out of range
    goX(frost, sim.frost, 8 * TILE, false);
    return { ember, frost };
  }

  // Approach steam and wait for a fat safe window.
  const frostCx = sim.frost.x + sim.frost.w / 2;
  if (!frostPastSteam) {
    const waitX = 40.2 * TILE;
    const inCurtain = frostCx > 41.6 * TILE && frostCx < 45 * TILE;
    const committed = frostCx >= waitX + 8;
    if (inCurtain && steam.phase !== "safe") {
      goX(frost, sim.frost, waitX, false);
    } else if (!committed && !(steam.phase === "safe" && steam.remainMs > 1000)) {
      goX(frost, sim.frost, waitX, false);
    } else {
      goX(frost, sim.frost, 47 * TILE, false);
    }
  } else {
    goX(frost, sim.frost, L01.plateFrostX, false);
  }

  return { ember, frost };
}

/** Suicide path: frost sprints the wisp corridor immediately. */
export function frostRushesWispPolicy(sim: SimState): PairIntent {
  const ember = cloneIntent();
  const frost = cloneIntent();
  goX(frost, sim.frost, 32 * TILE, false);
  return { ember, frost };
}
