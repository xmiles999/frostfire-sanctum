import { tileRect } from "../engine/aabb";
import { ACTOR_H, TILE } from "../engine/constants";
import type { LevelDocument } from "../sim/types";

const T = TILE;
const R = (tx: number, ty: number, tw: number, th: number) => tileRect(tx, ty, tw, th, T);

export const L04 = {
  emberSpawn: { x: 2.2 * T, y: 9 * T - ACTOR_H },
  frostSpawn: { x: 2.2 * T, y: 15 * T - ACTOR_H },
  innerEmberX: 13.2 * T,
  innerFrostX: 13.2 * T,
  holdEmberX: 13.4 * T,
  plateEmberX: 18.4 * T,
  plateFrostX: 18.4 * T,
  exitEmberX: 21.5 * T,
  exitFrostX: 21.5 * T,
};

export const LEVEL_04: LevelDocument = {
  id: "04",
  title: "双闸回廊",
  tile: T,
  size: { w: 24, h: 16 },
  puzzle: "phase",
  spawns: { ember: { ...L04.emberSpawn }, frost: { ...L04.frostSpawn } },
  exits: { ember: R(21, 6.6, 2, 2.4), frost: R(21, 12.6, 2, 2.4) },
  solids: [
    R(0, 0, 24, 1),
    R(0, 15, 24, 1),
    R(0, 0, 1, 16),
    R(23, 0, 1, 16),
    R(1, 6, 5, 0.55),
    R(1, 9, 22, 0.55),
  ],
  gatedSolids: [R(20, 1, 0.9, 8), R(20, 9, 0.9, 6)],
  hazards: [
    { id: "gap_mist", type: "ice_mist", rect: R(6.4, 9.55, 2.2, 4.5) },
    { id: "lava_gate_bed", type: "lava_shallow", rect: R(7.3, 8.55, 2.6, 0.5) },
    { id: "lava_inner", type: "lava_shallow", rect: R(10.2, 8.55, 2.4, 0.5) },
    { id: "water_gate_bed", type: "water_shallow", rect: R(7.3, 14, 2.6, 1) },
    { id: "lava_frost_inner", type: "lava_shallow", rect: R(9.6, 14.5, 2.2, 0.5) },
    { id: "steam", type: "steam_hot", rect: R(15.2, 10, 2.0, 5) },
    { id: "lava_exit", type: "lava_shallow", rect: R(21, 8.55, 2, 0.5) },
    { id: "water_exit", type: "water_shallow", rect: R(21, 14, 2, 1) },
  ],
  plates: { ember: R(17.2, 8.4, 2.4, 0.55), frost: R(17.2, 14.4, 2.4, 0.55) },
  altar: R(13.6, 12.4, 2.2, 2.2),
  wispNest: { x: 10.4 * T, y: 13.1 * T },
  chargeBudget: 1,
  score: { starTimeMs: 230_000, starDeaths: 5 },
  phaseGates: [
    { id: "lava_gate", side: "lava", rects: [R(8.0, 1, 1.15, 8)] },
    { id: "water_gate", side: "water", rects: [R(8.0, 9, 1.15, 6)] },
  ],
  oneWays: [
    { rect: R(12.2, 7.6, 1.1, 1.5), dir: 1 },
    { rect: R(12.2, 13.5, 1.1, 1.5), dir: 1 },
  ],
  extraPlates: [
    { id: "frost_lock", rect: R(12.4, 14.4, 2.4, 0.5), who: "frost" },
    { id: "ember_lock", rect: R(12.4, 8.4, 2.4, 0.5), who: "ember" },
  ],
  holdGates: [
    {
      id: "ember_holds_frost_steam",
      who: "ember",
      plate: R(13.0, 8.4, 2.4, 0.5),
      rects: [R(14.6, 10, 1.05, 5)],
    },
  ],
};
