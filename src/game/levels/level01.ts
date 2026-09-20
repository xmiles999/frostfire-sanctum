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
  emberSpawn: { x: 2.2 * T, y: 4 * T - ACTOR_H },
  frostSpawn: { x: 2.2 * T, y: 19 * T - ACTOR_H },
  lureX: 11.6 * T,
  holdEmberX: 14.2 * T,
  frostWaitX: 2.4 * T,
  frostPastGateX: 12.4 * T,
  steamWaitX: 15.6 * T,
  holdFrostX: 18.2 * T,
  emberWaitGateX: 17.2 * T,
  wispNest: { x: 12.4 * T, y: 7.15 * T },
  steamX: 16.6 * T,
  plateEmberX: 18.6 * T,
  plateFrostX: 18.6 * T,
  exitEmberX: 21.5 * T,
  exitFrostX: 21.5 * T,
  gapLeft: 7.2 * T,
  gapRight: 9.6 * T,
};

export const LEVEL_01: LevelDocument = {
  id: "01",
  title: "裂隙初醒",
  tile: T,
  size: { w: 24, h: 20 },
  spawns: {
    ember: { ...L01.emberSpawn },
    frost: { ...L01.frostSpawn },
  },
  exits: {
    ember: R(21, 5.8, 2, 2.2),
    frost: R(21, 16.6, 2, 2.4),
  },
  solids: [
    R(0, 0, 24, 1),
    R(0, 19, 6.6, 1),
    R(8.2, 19, 15.8, 1),
    R(0, 0, 1, 20),
    R(23, 0, 1, 20),
    R(1, 8, 4.4, 0.5),
    R(1.4, 6.6, 1.4, 0.4),
    R(2.6, 5.2, 1.4, 0.4),
    R(1, 4, 6.0, 0.5),
    R(9.4, 4, 3.6, 0.5),
    R(10.2, 8, 12.8, 0.5),
    R(17.6, 12, 5.4, 0.5),
    R(1, 16, 6.8, 0.5),
    R(10.6, 16, 6.2, 0.5),
  ],
  gatedSolids: [R(20, 1, 0.9, 11), R(20, 12, 0.9, 7)],
  hazards: [
    { id: "water_spawn", type: "water_shallow", rect: R(1, 18, 15.4, 1) },
    { id: "lava_jump", type: "lava_shallow", rect: R(6.7, 18.8, 1.4, 1.2) },
    { id: "water_mid", type: "water_shallow", rect: R(16.2, 18, 3.8, 1) },
    { id: "gap_mist", type: "ice_mist", rect: R(6.15, 4.55, 3.15, 1.6) },
    { id: "gap_ember_well", type: "ice_mist", rect: R(5.5, 8.55, 4.6, 3.2) },
    { id: "lava_lure", type: "lava_shallow", rect: R(11.4, 7.55, 3.2, 0.5) },
    { id: "steam", type: "steam_hot", rect: R(16.15, 13, 2.0, 6) },
    { id: "lava_exit", type: "lava_shallow", rect: R(21, 7.55, 2, 0.5) },
    { id: "water_exit", type: "water_shallow", rect: R(21, 18, 2, 1) },
  ],
  plates: {
    ember: R(17.4, 7.45, 2.4, 0.5),
    frost: R(17.4, 18.45, 2.4, 0.5),
  },
  altar: R(14.4, 16.4, 2.0, 2.2),
  wispNest: { ...L01.wispNest },
  chargeBudget: 1,
  puzzle: "dual_plates",
  score: { starTimeMs: STAR_TIME_MS, starDeaths: STAR_DEATHS_2 },
  holdGates: [
    {
      id: "ember_holds_frost",
      who: "ember",
      plate: R(13.2, 7.45, 2.2, 0.5),
      rects: [R(10.85, 16, 1.05, 3)],
    },
  ],
};
