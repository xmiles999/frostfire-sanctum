import { tileRect } from "../engine/aabb";
import { ACTOR_H, TILE } from "../engine/constants";
import type { LevelDocument } from "../sim/types";

const T = TILE;
const R = (tx: number, ty: number, tw: number, th: number) => tileRect(tx, ty, tw, th, T);

export const L03 = {
  emberSpawn: { x: 2.2 * T, y: 8 * T - ACTOR_H },
  frostSpawn: { x: 2.2 * T, y: 19 * T - ACTOR_H },
  igniteX: 10.2 * T,
  holdEmberX: 13.0 * T,
  gapX: 8 * T,
  plateEmberX: 18.6 * T,
  plateFrostX: 18.6 * T,
  exitEmberX: 21.5 * T,
  exitFrostX: 21.5 * T,
};

export const LEVEL_03: LevelDocument = {
  id: "03",
  title: "焦木栈道",
  tile: T,
  size: { w: 24, h: 20 },
  puzzle: "burn",
  spawns: { ember: { ...L03.emberSpawn }, frost: { ...L03.frostSpawn } },
  exits: { ember: R(21, 5.8, 2, 2.2), frost: R(21, 16.6, 2, 2.4) },
  solids: [
    R(0, 0, 24, 1),
    R(0, 19, 5.2, 1),
    R(13.4, 19, 9.6, 1),
    R(0, 0, 1, 20),
    R(23, 0, 1, 20),
    R(1, 4, 4.2, 0.5),
    R(1, 8, 6.2, 0.5),
    R(10.2, 8, 12.8, 0.5),
    R(17.6, 12, 5.4, 0.5),
    R(1, 16, 5.2, 0.5),
    R(13.4, 16, 9.6, 0.5),
  ],
  gatedSolids: [R(20, 1, 0.9, 11), R(20, 12, 0.9, 7)],
  hazards: [
    { id: "gap_ember_well", type: "ice_mist", rect: R(6.4, 8.55, 3.6, 3.2) },
    { id: "water_under", type: "water_shallow", rect: R(5.2, 18, 8.2, 1) },
    { id: "lava_exit", type: "lava_shallow", rect: R(21, 7.55, 2, 0.5) },
    { id: "water_exit", type: "water_shallow", rect: R(21, 18, 2, 1) },
  ],
  plates: { ember: R(17.4, 7.45, 2.4, 0.5), frost: R(17.4, 18.45, 2.4, 0.5) },
  altar: R(14.6, 16.4, 2.0, 2.2),
  wispNest: { x: -999, y: -999 },
  chargeBudget: 1,
  score: { starTimeMs: 220_000, starDeaths: 5 },
  holdGates: [
    {
      id: "ember_holds_frost_ash",
      who: "ember",
      plate: R(12.2, 7.45, 2.2, 0.5),
      rects: [R(15.2, 16, 1.05, 3)],
    },
  ],
  bridges: [
    { id: "wood_1", rect: R(5.2, 19, 3.2, 1), oily: false, ashRect: null },
    { id: "wood_mid", rect: R(8.4, 19, 5, 1), oily: true, ashRect: R(8.4, 19, 5, 1) },
    { id: "wood_3", rect: R(13.4, 19, 2.2, 1), oily: false, ashRect: null },
  ],
};
