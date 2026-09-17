import { tileRect } from "../engine/aabb";
import { ACTOR_H, TILE } from "../engine/constants";
import type { LevelDocument } from "../sim/types";

const T = TILE;
const R = (tx: number, ty: number, tw: number, th: number) => tileRect(tx, ty, tw, th, T);

export const L02 = {
  emberSpawn: { x: 2.2 * T, y: 6 * T - ACTOR_H },
  frostSpawn: { x: 2.2 * T, y: 15 * T - ACTOR_H },
  leverX: 8.4 * T,
  waitLeverX: 5.4 * T,
  holdEmberX: 14.2 * T,
  wellEdgeX: 9.4 * T,
  wellX: 11.3 * T,
  plateEmberX: 18.4 * T,
  plateFrostX: 18.4 * T,
  exitEmberX: 21.5 * T,
  exitFrostX: 21.5 * T,
};

export const LEVEL_02: LevelDocument = {
  id: "02",
  title: "潮汐石阶",
  tile: T,
  size: { w: 24, h: 16 },
  puzzle: "tide",
  doorLatchMs: 8000,
  spawns: { ember: { ...L02.emberSpawn }, frost: { ...L02.frostSpawn } },
  exits: { ember: R(21, 3.8, 2, 2.4), frost: R(21, 12.6, 2, 2.4) },
  solids: [
    R(0, 0, 24, 1),
    R(0, 15, 24, 1),
    R(0, 0, 1, 16),
    R(23, 0, 1, 16),
    R(1, 6, 22, 0.55),
    R(1, 9, 8, 0.55),
    R(10.5, 9, 12.5, 0.55),
    R(16.8, 3.2, 3.2, 0.55),
  ],
  gatedSolids: [R(20, 1, 0.9, 8), R(20, 9, 0.9, 6)],
  hazards: [
    { id: "gap_mist", type: "ice_mist", rect: R(8.2, 9.55, 2.2, 2.2) },
    { id: "lava_exit", type: "lava_shallow", rect: R(21, 8.55, 2, 0.5) },
    { id: "water_exit", type: "water_shallow", rect: R(21, 14, 2, 1) },
  ],
  plates: { ember: R(17.2, 5.4, 2.4, 0.55), frost: R(17.2, 14.4, 2.4, 0.55) },
  altar: R(15.2, 12.4, 2.2, 2.2),
  wispNest: { x: -999, y: -999 },
  chargeBudget: 1,
  score: { starTimeMs: 210_000, starDeaths: 5 },
  crates: [{ id: "well_crate", x: 3.2 * T, y: 15 * T - 40, w: 40, h: 40, density: 1.2 }],
  levers: [{ id: "tide", rect: R(7.5, 4.5, 2.2, 1.2), kind: "tide" }],
  holdGates: [
    {
      id: "ember_holds_frost_hall",
      who: "ember",
      plate: R(13.2, 5.4, 2.4, 0.5),
      rects: [R(16.2, 10, 1.05, 5)],
    },
  ],
  tide: {
    wellPlate: R(10.2, 14.35, 3.4, 0.7),
    ice: [R(6.2, 14.55, 3.6, 0.4)],
    floatIce: [R(13, 11.55, 5.5, 0.5)],
    shallowWater: [{ id: "tide_shallow", type: "water_shallow", rect: R(1, 14, 9, 1) }],
    midWater: [{ id: "tide_mid", type: "water_shallow", rect: R(6, 11.2, 14, 3.8) }],
    deepWater: [{ id: "tide_deep", type: "water_deep", rect: R(6, 11.2, 14, 3.8) }],
    flood: [{ id: "ember_flood", type: "water_deep", rect: R(1, 8.45, 19, 1.2) }],
  },
};
