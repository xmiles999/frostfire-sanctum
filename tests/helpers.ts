import { tileRect } from "../src/game/engine/aabb";
import { ACTOR_H, TILE } from "../src/game/engine/constants";
import { createSim } from "../src/game/sim/create";
import { stepSim } from "../src/game/sim/step";
import type { HazardType, LevelDocument, PairIntent, SimState } from "../src/game/sim/types";
import { EMPTY_INTENT } from "../src/game/sim/types";

export function blankLevel(over: Partial<LevelDocument> = {}): LevelDocument {
  const T = TILE;
  const R = (x: number, y: number, w: number, h: number) => tileRect(x, y, w, h, T);
  return {
    id: "t",
    title: "test",
    tile: T,
    size: { w: 24, h: 8 },
    spawns: { ember: { x: 2 * T, y: 7 * T - ACTOR_H }, frost: { x: 6 * T, y: 7 * T - ACTOR_H } },
    exits: { ember: R(20, 5, 2, 2), frost: R(22, 5, 2, 2) },
    solids: [R(0, 0, 24, 1), R(0, 7, 24, 1), R(0, 0, 1, 8), R(23, 0, 1, 8)],
    gatedSolids: [],
    hazards: [],
    plates: { ember: R(10, 6.5, 2, 0.5), frost: R(13, 6.5, 2, 0.5) },
    altar: R(4, 5, 2, 2),
    wispNest: { x: -999, y: -999 },
    chargeBudget: 1,
    score: { starTimeMs: 240000, starDeaths: 6 },
    ...over,
  };
}

export function idle(): PairIntent {
  return { ember: { ...EMPTY_INTENT }, frost: { ...EMPTY_INTENT } };
}

export function steps(sim: SimState, n: number, intents: PairIntent = idle()): void {
  for (let i = 0; i < n; i++) stepSim(sim, intents);
}

export function simWithHazard(type: HazardType, who: "ember" | "frost"): SimState {
  const level = blankLevel({
    hazards: [{ id: type, type, rect: tileRect(2, 6, 8, 2, TILE) }],
  });
  const sim = createSim(level);
  if (who === "ember") {
    sim.ember.x = 3 * TILE;
    sim.ember.y = 6.2 * TILE;
  } else {
    sim.frost.x = 3 * TILE;
    sim.frost.y = 6.2 * TILE;
  }
  return sim;
}
