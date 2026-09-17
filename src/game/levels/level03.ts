import { tileRect } from "../engine/aabb";
import { ACTOR_H, TILE } from "../engine/constants";
import type { LevelDocument } from "../sim/types";

const T = TILE;
const R = (tx: number, ty: number, tw: number, th: number) => tileRect(tx, ty, tw, th, T);

export const L03 = {
  emberSpawn: { x: 2.2 * T, y: 9 * T - ACTOR_H },
  frostSpawn: { x: 2.2 * T, y: 15 * T - ACTOR_H },
  igniteX: 10.2 * T,
  holdEmberX: 12.4 * T,
  gapX: 8 * T,
  plateEmberX: 18.4 * T,
  plateFrostX: 18.4 * T,
  exitEmberX: 21.5 * T,
  exitFrostX: 21.5 * T,
};

export const LEVEL_03: LevelDocument = {
  id: "03",
  title: "焦木栈道",
  tile: T,
  size: { w: 24, h: 16 },
  puzzle: "burn",
  spawns: { ember: { ...L03.emberSpawn }, frost: { ...L03.frostSpawn } },
  exits: { ember: R(21, 6.6, 2, 2.4), frost: R(21, 12.6, 2, 2.4) },
  solids: [
    R(0, 0, 24, 1),
    R(0, 15, 5.2, 1),
    R(13.4, 15, 9.6, 1),
    R(0, 0, 1, 16),
    R(23, 0, 1, 16),
    R(1, 6, 4.5, 0.55),
    R(1, 9, 6.2, 0.55),
    R(9.6, 9, 13.4, 0.55),
    R(1, 6, 4.5, 0.55),
  ],
  gatedSolids: [R(20, 1, 0.9, 8), R(20, 9, 0.9, 6)],
  hazards: [
    { id: "gap_mist", type: "ice_mist", rect: R(7.3, 9.55, 2.2, 2.4) },
    { id: "water_under", type: "water_shallow", rect: R(5.2, 14, 8.2, 1) },
    { id: "lava_exit", type: "lava_shallow", rect: R(21, 8.55, 2, 0.5) },
    { id: "water_exit", type: "water_shallow", rect: R(21, 14, 2, 1) },
  ],
  plates: { ember: R(17.2, 8.4, 2.4, 0.55), frost: R(17.2, 14.4, 2.4, 0.55) },
  altar: R(14.5, 12.4, 2.2, 2.2),
  wispNest: { x: -999, y: -999 },
  chargeBudget: 1,
  score: { starTimeMs: 220_000, starDeaths: 5 },
  holdGates: [
    {
      id: "ember_holds_frost_ash",
      who: "ember",
      plate: R(11.4, 8.4, 2.2, 0.5),
      rects: [R(15.2, 10, 1.05, 5)],
    },
  ],
  bridges: [
    { id: "wood_1", rect: R(5.2, 15, 3.2, 1), oily: false, ashRect: null },
    { id: "wood_mid", rect: R(8.4, 15, 5, 1), oily: true, ashRect: R(8.4, 15, 5, 1) },
    { id: "wood_3", rect: R(13.4, 15, 2.2, 1), oily: false, ashRect: null },
  ],
};
