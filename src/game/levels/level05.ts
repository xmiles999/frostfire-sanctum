import { R, roomY, finishRoom } from "./layout";
import { ACTOR_H, TILE } from "../engine/constants";
import type { LevelDocument } from "../sim/types";

const T = TILE;

export const L05 = {
  emberSpawn: { x: 2.2 * T, y: roomY(4) * T - ACTOR_H },
  frostSpawn: { x: 2.2 * T, y: roomY(19) * T - ACTOR_H },
  leverX: 6.8 * T,
  fireWindowX: 9.2 * T,
  frostChamberX: 11.2 * T,
  holdEmberX: 13.2 * T,
  plateEmberX: 18.6 * T,
  plateFrostX: 18.6 * T,
  exitEmberX: 21.5 * T,
  exitFrostX: 21.5 * T,
};

export const LEVEL_05: LevelDocument = finishRoom({
  id: "05",
  title: "沉钟齿轮",
  tile: T,
  size: { w: 24, h: 14 },
  puzzle: "gear",
  spawns: { ember: { ...L05.emberSpawn }, frost: { ...L05.frostSpawn } },
  exits: { ember: R(21, 5.8, 2, 2.2), frost: R(21, 16.6, 2, 2.4) },
  solids: [
    R(0, 0, 24, 1),
    R(0, 19, 8.5, 1),
    R(10.0, 19, 2.6, 1),
    R(14.0, 19, 10.0, 1),
    R(0, 0, 1, 20),
    R(23, 0, 1, 20),
    R(1, 4, 9.2, 0.5),
    R(1, 8, 5.4, 0.5),
    R(9.2, 8, 13.8, 0.5),
    R(16.8, 2.2, 6.2, 0.5),
    R(17.6, 12, 5.4, 0.5),
    R(1, 16, 7.2, 0.5),
    R(10.6, 16, 6.2, 0.5),
  ],
  gatedSolids: [R(20, 1, 0.9, 11), R(20, 12, 0.9, 7)],
  hazards: [
    { id: "gap_mist", type: "ice_mist", rect: R(5.6, 8.55, 3.4, 3.4) },
    { id: "fake_mist", type: "ice_mist", rect: R(8.4, 8.55, 2.4, 3.0) },
    { id: "lava_fake", type: "lava_shallow", rect: R(8.5, 7.55, 2.2, 0.5) },
    { id: "lava_frost_early", type: "lava_shallow", rect: R(8.6, 18.8, 1.3, 1.2) },
    { id: "lava_frost_hall", type: "lava_shallow", rect: R(12.7, 18.8, 1.2, 1.2) },
    { id: "lava_exit", type: "lava_shallow", rect: R(21, 7.55, 2, 0.5) },
    { id: "water_exit", type: "water_shallow", rect: R(21, 18, 2, 1) },
  ],
  plates: { ember: R(17.4, 7.45, 2.4, 0.5), frost: R(17.4, 18.45, 2.4, 0.5) },
  altar: R(14.6, 16.4, 2.0, 2.2),
  wispNest: { x: -999, y: -999 },
  chargeBudget: 1,
  score: { starTimeMs: 260_000, starDeaths: 4 },
  levers: [{ id: "gear_a", rect: R(5.8, 2.5, 2.2, 1.2), kind: "gear" }],
  holdGates: [
    {
      id: "ember_holds_frost_hall",
      who: "ember",
      plate: R(12.2, 7.45, 2.2, 0.5),
      rects: [R(15.2, 16, 1.05, 3)],
    },
  ],
  gear: {
    cycleMs: 10000,
    windows: [
      {
        id: "fire",
        openAtMs: 0,
        closeAtMs: 2200,
        solidsWhenClosed: [R(8.4, 1, 1.1, 11)],
      },
      {
        id: "frost_early",
        openAtMs: 1400,
        closeAtMs: 3000,
        solidsWhenClosed: [R(8.4, 8.5, 1.1, 10.5)],
      },
      {
        id: "frost_real",
        openAtMs: 3600,
        closeAtMs: 10000,
        solidsWhenClosed: [R(12.2, 8.5, 1.1, 10.5)],
      },
    ],
  },
});
