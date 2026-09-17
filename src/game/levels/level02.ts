import { tileRect } from "../engine/aabb";
import { ACTOR_H, TILE } from "../engine/constants";
import type { LevelDocument } from "../sim/types";

const T = TILE;
const R = (tx: number, ty: number, tw: number, th: number) => tileRect(tx, ty, tw, th, T);

export const L02 = {
  emberSpawn: { x: 2.4 * T, y: 6 * T - ACTOR_H },
  frostSpawn: { x: 2.4 * T, y: 15 * T - ACTOR_H },
  leverX: 19 * T,
  wellEdgeX: 38 * T,
  wellX: 42 * T,
  plateEmberX: 52 * T,
  plateFrostX: 52 * T,
  exitEmberX: 67.2 * T,
  exitFrostX: 67.2 * T,
};

export const LEVEL_02: LevelDocument = {
  id: "02",
  title: "潮汐石阶",
  tile: T,
  size: { w: 72, h: 16 },
  puzzle: "tide",
  doorLatchMs: 8000,
  spawns: { ember: { ...L02.emberSpawn }, frost: { ...L02.frostSpawn } },
  exits: { ember: R(66, 5.5, 3, 2.6), frost: R(66, 12.5, 3, 2.6) },
  solids: [
    R(0, 0, 72, 1),
    R(0, 15, 40, 1),
    R(40, 15, 6, 1),
    R(46, 15, 26, 1),
    R(0, 0, 1, 16),
    R(71, 0, 1, 16),
    R(1, 6, 10, 1),
    R(16, 5.5, 8, 1),
    R(1, 8, 55, 1),
    R(57, 8, 14, 1),
    R(57, 12, 4, 1),
  ],
  gatedSolids: [R(56, 1, 1, 8), R(56, 9, 1, 6)],
  hazards: [
    { id: "lava_exit", type: "lava_shallow", rect: R(58, 7.55, 8, 0.5) },
    { id: "water_exit", type: "water_shallow", rect: R(58, 14, 8, 1) },
  ],
  plates: { ember: R(50.6, 7.45, 3.2, 0.6), frost: R(50.6, 14.45, 3.2, 0.6) },
  altar: R(48, 12.4, 2.6, 2.6),
  wispNest: { x: -999, y: -999 },
  chargeBudget: 1,
  score: { starTimeMs: 210_000, starDeaths: 5 },
  crates: [{ id: "well_crate", x: 8 * T, y: 15 * T - 40, w: 40, h: 40, density: 1.2 }],
  levers: [{ id: "tide", rect: R(18.2, 4.4, 2.2, 1.2), kind: "tide" }],
  tide: {
    wellPlate: R(41, 14.4, 4, 0.7),
    ice: [R(22, 14.55, 10, 0.45)],
    floatIce: [R(46, 11.15, 10, 0.55)],
    shallowWater: [{ id: "tide_shallow", type: "water_shallow", rect: R(1, 14, 18, 1) }],
    midWater: [{ id: "tide_mid", type: "water_shallow", rect: R(18, 11, 38, 4) }],
    deepWater: [{ id: "tide_deep", type: "water_deep", rect: R(18, 11, 38, 4) }],
    flood: [{ id: "ember_flood", type: "water_deep", rect: R(1, 7.45, 55, 1.2) }],
  },
};
