import { tileRect } from "../engine/aabb";
import { ACTOR_H, TILE } from "../engine/constants";
import type { LevelDocument } from "../sim/types";

const T = TILE;
const R = (tx: number, ty: number, tw: number, th: number) => tileRect(tx, ty, tw, th, T);

export const L02 = {
  emberSpawn: { x: 2.2 * T, y: 4 * T - ACTOR_H },
  frostSpawn: { x: 2.2 * T, y: 19 * T - ACTOR_H },
  leverX: 8.6 * T,
  waitLeverX: 5.2 * T,
  holdEmberX: 14.4 * T,
  wellEdgeX: 9.4 * T,
  wellX: 11.3 * T,
  plateEmberX: 18.6 * T,
  plateFrostX: 18.6 * T,
  exitEmberX: 21.5 * T,
  exitFrostX: 21.5 * T,
};

export const LEVEL_02: LevelDocument = {
  id: "02",
  title: "潮汐石阶",
  tile: T,
  size: { w: 24, h: 20 },
  puzzle: "tide",
  doorLatchMs: 8000,
  spawns: { ember: { ...L02.emberSpawn }, frost: { ...L02.frostSpawn } },
  exits: { ember: R(21, 2.0, 2, 2.2), frost: R(21, 16.6, 2, 2.4) },
  solids: [
    R(0, 0, 24, 1),
    R(0, 19, 24, 1),
    R(0, 0, 1, 20),
    R(23, 0, 1, 20),
    R(1.5, 6.6, 1.5, 0.4),
    R(2.8, 5.2, 1.5, 0.4),
    R(1, 4, 10.0, 0.5),
    R(12.6, 4, 10.4, 0.5),
    R(16.8, 2.2, 6.2, 0.5),
    R(1, 8, 8.2, 0.5),
    R(11.0, 8, 12.0, 0.5),
    R(17.6, 12, 5.4, 0.5),
    R(1, 16, 8.0, 0.5),
    R(10.8, 16, 6.0, 0.5),
  ],
  gatedSolids: [R(20, 1, 0.9, 11), R(20, 12, 0.9, 7)],
  hazards: [
    { id: "gap_mist", type: "ice_mist", rect: R(8.4, 8.55, 2.4, 3.2) },
    { id: "gap_loft", type: "ice_mist", rect: R(12.2, 4.55, 2.2, 3.2) },
    { id: "lava_exit", type: "lava_shallow", rect: R(21, 3.75, 2, 0.45) },
    { id: "water_exit", type: "water_shallow", rect: R(21, 18, 2, 1) },
  ],
  plates: { ember: R(17.4, 3.65, 2.4, 0.5), frost: R(17.4, 18.45, 2.4, 0.5) },
  altar: R(14.8, 16.4, 2.0, 2.2),
  wispNest: { x: -999, y: -999 },
  chargeBudget: 1,
  score: { starTimeMs: 210_000, starDeaths: 5 },
  crates: [{ id: "well_crate", x: 3.2 * T, y: 19 * T - 28, w: 28, h: 28, density: 1.2 }],
  levers: [{ id: "tide", rect: R(7.6, 2.5, 2.2, 1.2), kind: "tide" }],
  holdGates: [
    {
      id: "ember_holds_frost_hall",
      who: "ember",
      plate: R(13.4, 3.65, 2.4, 0.5),
      rects: [R(16.2, 16, 1.05, 3)],
    },
  ],
  tide: {
    wellPlate: R(10.2, 18.35, 3.4, 0.7),
    ice: [R(6.2, 18.55, 3.6, 0.4)],
    floatIce: [R(13, 14.55, 5.5, 0.5)],
    shallowWater: [{ id: "tide_shallow", type: "water_shallow", rect: R(1, 18, 9, 1) }],
    midWater: [{ id: "tide_mid", type: "water_shallow", rect: R(6, 15.2, 14, 3.8) }],
    deepWater: [{ id: "tide_deep", type: "water_deep", rect: R(6, 15.2, 14, 3.8) }],
    flood: [{ id: "ember_flood", type: "water_deep", rect: R(1, 7.45, 19, 1.2) }],
  },
};
