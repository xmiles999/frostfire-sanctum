import { R, roomY, finishRoom } from "./layout";
import { ACTOR_H, TILE } from "../engine/constants";
import type { LevelDocument } from "../sim/types";

const T = TILE;

export const L04 = {
  emberSpawn: { x: 2.2 * T, y: roomY(8) * T - ACTOR_H },
  frostSpawn: { x: 2.2 * T, y: roomY(19) * T - ACTOR_H },
  innerEmberX: 13.4 * T,
  innerFrostX: 13.4 * T,
  holdEmberX: 14.0 * T,
  plateEmberX: 18.6 * T,
  plateFrostX: 18.6 * T,
  exitEmberX: 21.5 * T,
  exitFrostX: 21.5 * T,
};

export const LEVEL_04: LevelDocument = finishRoom({
  id: "04",
  title: "双闸回廊",
  tile: T,
  size: { w: 24, h: 14 },
  puzzle: "phase",
  spawns: { ember: { ...L04.emberSpawn }, frost: { ...L04.frostSpawn } },
  exits: { ember: R(21, 5.8, 2, 2.2), frost: R(21, 16.6, 2, 2.4) },
  solids: [
    R(0, 0, 24, 1),
    R(0, 19, 9.4, 1),
    R(10.8, 19, 13.2, 1),
    R(0, 0, 1, 20),
    R(23, 0, 1, 20),
    R(1, 4, 5.2, 0.5),
    R(1, 8, 22, 0.5),
    R(17.6, 12, 5.4, 0.5),
    R(1, 16, 22, 0.5),
  ],
  gatedSolids: [R(20, 1, 0.9, 11), R(20, 12, 0.9, 7)],
  hazards: [
    { id: "gap_mist", type: "ice_mist", rect: R(6.2, 8.55, 2.4, 3.4) },
    { id: "lava_gate_bed", type: "lava_shallow", rect: R(7.3, 7.55, 2.6, 0.5) },
    { id: "lava_inner", type: "lava_shallow", rect: R(10.2, 7.55, 2.4, 0.5) },
    { id: "water_gate_bed", type: "water_shallow", rect: R(7.3, 18, 2.6, 1) },
    { id: "lava_frost_inner", type: "lava_shallow", rect: R(9.5, 18.8, 1.2, 1.2) },
    { id: "steam", type: "steam_hot", rect: R(15.2, 13, 2.0, 6) },
    { id: "lava_exit", type: "lava_shallow", rect: R(21, 7.55, 2, 0.5) },
    { id: "water_exit", type: "water_shallow", rect: R(21, 18, 2, 1) },
  ],
  plates: { ember: R(17.4, 7.45, 2.4, 0.5), frost: R(17.4, 18.45, 2.4, 0.5) },
  altar: R(14.2, 16.4, 2.0, 2.2),
  wispNest: { x: 11.2 * T, y: roomY(7.2) * T },
  chargeBudget: 1,
  score: { starTimeMs: 230_000, starDeaths: 5 },
  phaseGates: [
    { id: "lava_gate", side: "lava", rects: [R(8.0, 1, 1.15, 11)] },
    { id: "water_gate", side: "water", rects: [R(8.0, 12, 1.15, 7)] },
  ],
  oneWays: [
    { rect: R(12.2, 6.6, 1.1, 1.5), dir: 1 },
    { rect: R(12.2, 17.5, 1.1, 1.5), dir: 1 },
  ],
  extraPlates: [
    { id: "frost_lock", rect: R(12.4, 18.45, 2.4, 0.5), who: "frost" },
    { id: "ember_lock", rect: R(12.4, 7.45, 2.4, 0.5), who: "ember" },
  ],
  holdGates: [
    {
      id: "ember_holds_frost_steam",
      who: "ember",
      plate: R(13.2, 7.45, 2.4, 0.5),
      rects: [R(14.6, 13, 1.05, 6)],
    },
  ],
});
