import { tileRect } from "../engine/aabb";
import { ACTOR_H, TILE } from "../engine/constants";
import type { LevelDocument } from "../sim/types";

const T = TILE;
const R = (tx: number, ty: number, tw: number, th: number) => tileRect(tx, ty, tw, th, T);

export const L04 = {
  emberSpawn: { x: 2.4 * T, y: 8 * T - ACTOR_H },
  frostSpawn: { x: 2.4 * T, y: 15 * T - ACTOR_H },
  innerEmberX: 38 * T,
  innerFrostX: 38 * T,
  holdEmberX: 34.6 * T,
  plateEmberX: 52 * T,
  plateFrostX: 52 * T,
  exitEmberX: 67.2 * T,
  exitFrostX: 67.2 * T,
};

export const LEVEL_04: LevelDocument = {
  id: "04",
  title: "双闸回廊",
  tile: T,
  size: { w: 72, h: 16 },
  puzzle: "phase",
  spawns: { ember: { ...L04.emberSpawn }, frost: { ...L04.frostSpawn } },
  exits: { ember: R(66, 5.5, 3, 2.6), frost: R(66, 12.5, 3, 2.6) },
  solids: [
    R(0, 0, 72, 1),
    R(0, 15, 72, 1),
    R(0, 0, 1, 16),
    R(71, 0, 1, 16),
    R(1, 8, 9, 1),
    R(13.2, 8, 41.8, 1),
    R(1, 15, 55, 1),
    R(57, 8, 14, 1),
    R(32, 5.5, 6, 1),
  ],
  gatedSolids: [R(56, 1, 1, 8), R(56, 9, 1, 6)],
  hazards: [
    { id: "gap_mist", type: "ice_mist", rect: R(9.8, 9, 3.4, 5) },
    { id: "lava_gate_bed", type: "lava_shallow", rect: R(18.2, 7.55, 3.6, 0.5) },
    { id: "lava_inner", type: "lava_shallow", rect: R(26.2, 7.55, 3.2, 0.5) },
    { id: "water_gate_bed", type: "water_shallow", rect: R(18.2, 14, 3.6, 1) },
    { id: "lava_frost_inner", type: "lava_shallow", rect: R(26.2, 14.5, 3.2, 0.5) },
    { id: "steam", type: "steam_hot", rect: R(44, 10, 2.8, 5) },
    { id: "lava_exit", type: "lava_shallow", rect: R(58, 7.55, 8, 0.5) },
    { id: "water_exit", type: "water_shallow", rect: R(58, 14, 8, 1) },
  ],
  plates: { ember: R(50.6, 7.45, 3.2, 0.6), frost: R(50.6, 14.45, 3.2, 0.6) },
  altar: R(46, 12.4, 2.6, 2.6),
  wispNest: { x: 20.5 * T, y: 12.8 * T },
  chargeBudget: 1,
  score: { starTimeMs: 230_000, starDeaths: 5 },
  phaseGates: [
    { id: "lava_gate", side: "lava", rects: [R(19, 1, 1.4, 7)] },
    { id: "water_gate", side: "water", rects: [R(19, 9, 1.4, 6)] },
  ],
  oneWays: [
    { rect: R(30, 6.5, 1.2, 1.6), dir: 1 },
    { rect: R(30, 13.5, 1.2, 1.6), dir: 1 },
  ],
  extraPlates: [
    { id: "frost_lock", rect: R(36, 14.45, 3, 0.55), who: "frost" },
    { id: "ember_lock", rect: R(36, 7.45, 3, 0.55), who: "ember" },
  ],
  holdGates: [
    {
      id: "ember_holds_frost_steam",
      who: "ember",
      plate: R(33.2, 4.95, 3.0, 0.55),
      rects: [R(42.2, 9, 1.2, 6)],
    },
  ],
};
