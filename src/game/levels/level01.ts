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
  emberSpawn: { x: 2.4 * T, y: 5 * T - ACTOR_H },
  frostSpawn: { x: 2.4 * T, y: 15 * T - ACTOR_H },
  lureX: 30 * T,
  wispNest: { x: 28 * T, y: 13.2 * T },
  steamX: 42 * T,
  plateEmberX: 52 * T,
  plateFrostX: 52 * T,
  exitEmberX: 67.2 * T,
  exitFrostX: 67.2 * T,
  gapLeft: 17 * T,
  gapRight: 20.2 * T,
};

export const LEVEL_01: LevelDocument = {
  id: "01",
  title: "裂隙初醒",
  tile: T,
  size: { w: 72, h: 16 },
  spawns: {
    ember: { ...L01.emberSpawn },
    frost: { ...L01.frostSpawn },
  },
  exits: {
    ember: R(66, 5.5, 3, 2.6),
    frost: R(66, 12.5, 3, 2.6),
  },
  solids: [
    R(0, 0, 72, 1),
    R(0, 15, 72, 1),
    R(0, 0, 1, 16),
    R(71, 0, 1, 16),
    // ember spawn ledge, then segmented road with a void gap and a rise
    R(1, 5, 5, 1),
    R(1, 8, 16, 1),
    R(20.2, 8, 15.8, 1),
    R(36, 6.5, 8, 1),
    R(44, 8, 12, 1),
    R(57.2, 8, 2.1, 1),
    R(61, 8, 2.1, 1),
    R(64.6, 8, 6.4, 1),
  ],
  gatedSolids: [R(56, 1, 1, 8), R(56, 9, 1, 6)],
  hazards: [
    { id: "water_spawn", type: "water_shallow", rect: R(1, 14, 16, 1) },
    { id: "lava_jump", type: "lava_shallow", rect: R(17.2, 14.5, 3.4, 0.5) },
    { id: "water_mid", type: "water_shallow", rect: R(21, 14, 19, 1) },
    { id: "gap_mist", type: "ice_mist", rect: R(17, 9, 3.2, 5) },
    { id: "lava_lure", type: "lava_shallow", rect: R(22, 7.55, 14, 0.5) },
    { id: "steam", type: "steam_hot", rect: R(42, 10, 3, 5) },
    { id: "lava_exit", type: "lava_shallow", rect: R(58, 7.55, 8, 0.5) },
    { id: "water_exit", type: "water_shallow", rect: R(58, 14, 8, 1) },
  ],
  plates: {
    ember: R(50.6, 7.45, 3.2, 0.6),
    frost: R(50.6, 14.45, 3.2, 0.6),
  },
  altar: R(48, 12.4, 2.6, 2.6),
  wispNest: { ...L01.wispNest },
  chargeBudget: 1,
  score: { starTimeMs: STAR_TIME_MS, starDeaths: STAR_DEATHS_2 },
};
