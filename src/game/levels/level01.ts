import { tileRect } from "../engine/aabb";
import {
  ACTOR_H,
  STAR_DEATHS_2,
  STAR_TIME_MS,
  TILE,
} from "../engine/constants";
import type { LevelDocument } from "../sim/types";

const T = TILE;
const R = (tx: number, ty: number, tw: number, th: number) => tileRect(tx, ty, tw, th, T);

/** Pixel landmarks used by the official policy and tests. */
export const L01 = {
  emberSpawn: { x: 2.2 * T, y: 9 * T - ACTOR_H },
  frostSpawn: { x: 2.2 * T, y: 15 * T - ACTOR_H },
  lureX: 12.2 * T,
  holdEmberX: 13.5 * T,
  frostWaitX: 2.4 * T,
  frostPastGateX: 13.6 * T,
  steamWaitX: 14.0 * T,
  holdFrostX: 17.4 * T,
  emberWaitGateX: 16.8 * T,
  wispNest: { x: 14.2 * T, y: 13.15 * T },
  steamX: 16.2 * T,
  plateEmberX: 18.4 * T,
  plateFrostX: 18.4 * T,
  exitEmberX: 21.5 * T,
  exitFrostX: 21.5 * T,
  gapLeft: 7.1 * T,
  gapRight: 9.7 * T,
};

export const LEVEL_01: LevelDocument = {
  id: "01",
  title: "裂隙初醒",
  tile: T,
  size: { w: 24, h: 16 },
  spawns: {
    ember: { ...L01.emberSpawn },
    frost: { ...L01.frostSpawn },
  },
  exits: {
    ember: R(21, 6.6, 2, 2.4),
    frost: R(21, 12.6, 2, 2.4),
  },
  solids: [
    R(0, 0, 24, 1),
    R(0, 15, 24, 1),
    R(0, 0, 1, 16),
    R(23, 0, 1, 16),
    R(1, 6, 5, 0.55),
    R(1, 9, 6.1, 0.55),
    R(9.8, 9, 13.2, 0.55),
  ],
  gatedSolids: [R(20, 1, 0.9, 8), R(20, 9, 0.9, 6)],
  hazards: [
    { id: "water_spawn", type: "water_shallow", rect: R(1, 14, 15.2, 1) },
    { id: "lava_jump", type: "lava_shallow", rect: R(16.2, 8.55, 1.8, 0.5) },
    { id: "water_mid", type: "water_shallow", rect: R(16.2, 14, 3.8, 1) },
    { id: "gap_mist", type: "ice_mist", rect: R(7.15, 9.55, 2.6, 2.4) },
    { id: "lava_lure", type: "lava_shallow", rect: R(11.2, 8.55, 3.4, 0.5) },
    { id: "steam", type: "steam_hot", rect: R(16.15, 10, 2.0, 5) },
    { id: "lava_exit", type: "lava_shallow", rect: R(21, 8.55, 2, 0.5) },
    { id: "water_exit", type: "water_shallow", rect: R(21, 14, 2, 1) },
  ],
  plates: {
    ember: R(17.2, 8.4, 2.4, 0.55),
    frost: R(17.2, 14.4, 2.4, 0.55),
  },
  altar: R(13.2, 12.4, 2.2, 2.2),
  wispNest: { ...L01.wispNest },
  chargeBudget: 1,
  puzzle: "dual_plates",
  score: { starTimeMs: STAR_TIME_MS, starDeaths: STAR_DEATHS_2 },
  holdGates: [
    {
      id: "ember_holds_frost",
      who: "ember",
      plate: R(12.6, 8.4, 2.2, 0.5),
      rects: [R(13.05, 10, 1.05, 5)],
    },
  ],
};
