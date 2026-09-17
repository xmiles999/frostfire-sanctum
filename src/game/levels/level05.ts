import { tileRect } from "../engine/aabb";
import { ACTOR_H, TILE } from "../engine/constants";
import type { LevelDocument } from "../sim/types";

const T = TILE;
const R = (tx: number, ty: number, tw: number, th: number) => tileRect(tx, ty, tw, th, T);

export const L05 = {
  emberSpawn: { x: 2.2 * T, y: 6 * T - ACTOR_H },
  frostSpawn: { x: 2.2 * T, y: 15 * T - ACTOR_H },
  leverX: 6.8 * T,
  fireWindowX: 9.2 * T,
  frostChamberX: 11.2 * T,
  holdEmberX: 12.6 * T,
  plateEmberX: 18.4 * T,
  plateFrostX: 18.4 * T,
  exitEmberX: 21.5 * T,
  exitFrostX: 21.5 * T,
};

export const LEVEL_05: LevelDocument = {
  id: "05",
  title: "沉钟齿轮",
  tile: T,
  size: { w: 24, h: 16 },
  puzzle: "gear",
  spawns: { ember: { ...L05.emberSpawn }, frost: { ...L05.frostSpawn } },
  exits: { ember: R(21, 6.6, 2, 2.4), frost: R(21, 12.6, 2, 2.4) },
  solids: [
    R(0, 0, 24, 1),
    R(0, 15, 24, 1),
    R(0, 0, 1, 16),
    R(23, 0, 1, 16),
    R(1, 6, 9.2, 0.55),
    R(1, 9, 5.4, 0.55),
    R(8.8, 9, 14.2, 0.55),
    R(16.8, 3.2, 3.2, 0.55),
  ],
  gatedSolids: [R(20, 1, 0.9, 8), R(20, 9, 0.9, 6)],
  hazards: [
    { id: "gap_mist", type: "ice_mist", rect: R(6.5, 9.55, 2.2, 4.6) },
    { id: "fake_mist", type: "ice_mist", rect: R(8.4, 6.4, 2.4, 1.8) },
    { id: "lava_fake", type: "lava_shallow", rect: R(8.5, 8.55, 2.2, 0.5) },
    { id: "lava_frost_early", type: "lava_shallow", rect: R(8.7, 14.5, 1.6, 0.5) },
    { id: "lava_frost_hall", type: "lava_shallow", rect: R(12.6, 14.5, 2.4, 0.5) },
    { id: "lava_exit", type: "lava_shallow", rect: R(21, 8.55, 2, 0.5) },
    { id: "water_exit", type: "water_shallow", rect: R(21, 14, 2, 1) },
  ],
  plates: { ember: R(17.2, 8.4, 2.4, 0.55), frost: R(17.2, 14.4, 2.4, 0.55) },
  altar: R(14.4, 12.4, 2.2, 2.2),
  wispNest: { x: -999, y: -999 },
  chargeBudget: 1,
  score: { starTimeMs: 260_000, starDeaths: 4 },
  levers: [{ id: "gear_a", rect: R(5.8, 4.5, 2.2, 1.2), kind: "gear" }],
  holdGates: [
    {
      id: "ember_holds_frost_hall",
      who: "ember",
      plate: R(11.6, 8.4, 2.2, 0.5),
      rects: [R(15.2, 10, 1.05, 5)],
    },
  ],
  gear: {
    windows: [
      {
        id: "fire",
        openAtMs: 0,
        closeAtMs: 2200,
        solidsWhenClosed: [R(8.4, 1, 1.1, 8)],
      },
      {
        id: "frost_early",
        openAtMs: 1400,
        closeAtMs: 3000,
        solidsWhenClosed: [R(8.4, 9, 1.1, 6)],
      },
      {
        id: "frost_real",
        openAtMs: 3600,
        closeAtMs: 200000,
        solidsWhenClosed: [R(12.2, 9, 1.1, 6)],
      },
    ],
  },
};
