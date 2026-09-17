import { tileRect } from "../engine/aabb";
import { ACTOR_H, TILE } from "../engine/constants";
import type { LevelDocument } from "../sim/types";

const T = TILE;
const R = (tx: number, ty: number, tw: number, th: number) => tileRect(tx, ty, tw, th, T);

export const L03 = {
  emberSpawn: { x: 2.4 * T, y: 8 * T - ACTOR_H },
  frostSpawn: { x: 2.4 * T, y: 12 * T - ACTOR_H },
  igniteX: 18 * T,
  holdEmberX: 19.4 * T,
  gapX: 28 * T,
  plateEmberX: 52 * T,
  plateFrostX: 52 * T,
  exitEmberX: 67.2 * T,
  exitFrostX: 67.2 * T,
};

export const LEVEL_03: LevelDocument = {
  id: "03",
  title: "焦木栈道",
  tile: T,
  size: { w: 72, h: 16 },
  puzzle: "burn",
  spawns: { ember: { ...L03.emberSpawn }, frost: { ...L03.frostSpawn } },
  exits: { ember: R(66, 5.5, 3, 2.6), frost: R(66, 9.5, 3, 2.6) },
  solids: [
    R(0, 0, 72, 1),
    R(0, 15, 72, 1),
    R(0, 0, 1, 16),
    R(71, 0, 1, 16),
    R(1, 8, 9, 1),
    R(13.2, 8, 40.8, 1),
    R(1, 12, 8, 1),
    R(31, 12, 25, 1),
    R(57, 8, 14, 1),
    R(57, 12, 14, 1),
  ],
  gatedSolids: [R(56, 1, 1, 8), R(56, 9, 1, 6)],
  hazards: [
    { id: "gap_mist", type: "ice_mist", rect: R(9.8, 9, 3.4, 2.6) },
    { id: "lava_exit", type: "lava_shallow", rect: R(58, 7.55, 8, 0.5) },
    { id: "water_under", type: "water_shallow", rect: R(8, 14, 28, 1) },
    { id: "water_exit", type: "water_shallow", rect: R(58, 14, 8, 1) },
    { id: "ice_false", type: "ice_mist", rect: R(22, 9, 4, 2.2) },
  ],
  plates: { ember: R(50.6, 7.45, 3.2, 0.6), frost: R(50.6, 11.45, 3.2, 0.6) },
  altar: R(46, 10, 2.6, 2.6),
  wispNest: { x: -999, y: -999 },
  chargeBudget: 1,
  score: { starTimeMs: 220_000, starDeaths: 5 },
  holdGates: [
    {
      id: "ember_holds_frost_ash",
      who: "ember",
      plate: R(18.2, 7.45, 2.6, 0.55),
      rects: [R(36.2, 9, 1.2, 3.2)],
    },
  ],
  bridges: [
    { id: "wood_1", rect: R(8, 12, 6, 1), oily: false, ashRect: null },
    { id: "wood_mid", rect: R(14, 12, 8, 1), oily: true, ashRect: R(26, 12, 5, 1) },
    { id: "wood_3", rect: R(22, 12, 4, 1), oily: false, ashRect: null },
  ],
};
