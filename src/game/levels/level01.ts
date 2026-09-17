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
  gapRight: 20 * T,
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
    // ember spawn ledge (3-tile drop onto main floor)
    R(1, 5, 6, 1),
    // ember main floor through the latch door to the hearth niche
    R(1, 8, 70, 1),
  ],
  gatedSolids: [R(56, 1, 1, 8), R(56, 9, 1, 6)],
  hazards: [
    { id: "water_spawn", type: "water_shallow", rect: R(1, 14, 10, 1) },
    { id: "water_mid", type: "water_shallow", rect: R(12, 14, 6, 1) },
    { id: "lava_lure", type: "lava_shallow", rect: R(22, 7.55, 14, 0.5) },
    { id: "steam", type: "steam_hot", rect: R(42, 10, 2.2, 5) },
    { id: "lava_exit", type: "lava_shallow", rect: R(58, 7.55, 8, 0.5) },
    { id: "water_exit", type: "water_shallow", rect: R(58, 14, 8, 1) },
  ],
  plates: {
    ember: R(51.2, 7.55, 2.2, 0.5),
    frost: R(51.2, 14.55, 2.2, 0.5),
  },
  altar: R(49, 13, 2, 2),
  wispNest: { ...L01.wispNest },
  chargeBudget: 1,
  score: { starTimeMs: STAR_TIME_MS, starDeaths: STAR_DEATHS_2 },
};
