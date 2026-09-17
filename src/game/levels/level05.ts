import { tileRect } from "../engine/aabb";
import { ACTOR_H, TILE } from "../engine/constants";
import type { LevelDocument } from "../sim/types";

const T = TILE;
const R = (tx: number, ty: number, tw: number, th: number) => tileRect(tx, ty, tw, th, T);

export const L05 = {
  emberSpawn: { x: 2.4 * T, y: 8 * T - ACTOR_H },
  frostSpawn: { x: 2.4 * T, y: 15 * T - ACTOR_H },
  leverX: 15.5 * T,
  fireWindowX: 22 * T,
  frostChamberX: 24 * T,
  holdEmberX: 25.6 * T,
  plateEmberX: 52 * T,
  plateFrostX: 52 * T,
  exitEmberX: 67.2 * T,
  exitFrostX: 67.2 * T,
};

export const LEVEL_05: LevelDocument = {
  id: "05",
  title: "沉钟齿轮",
  tile: T,
  size: { w: 72, h: 16 },
  puzzle: "gear",
  spawns: { ember: { ...L05.emberSpawn }, frost: { ...L05.frostSpawn } },
  exits: { ember: R(66, 5.5, 3, 2.6), frost: R(66, 12.5, 3, 2.6) },
  solids: [
    R(0, 0, 72, 1),
    R(0, 15, 72, 1),
    R(0, 0, 1, 16),
    R(71, 0, 1, 16),
    R(1, 8, 6, 1),
    R(9.5, 8, 8.5, 1),
    R(22, 8, 34, 1),
    R(1, 15, 20, 1),
    R(24, 15, 32, 1),
    R(57, 8, 14, 1),
    R(18, 5.2, 5, 1),
  ],
  gatedSolids: [R(56, 1, 1, 8), R(56, 9, 1, 6)],
  hazards: [
    { id: "gap_mist", type: "ice_mist", rect: R(6.2, 9, 3.3, 5) },
    { id: "fake_mist", type: "ice_mist", rect: R(19, 6.2, 3, 1.8) },
    { id: "lava_fake", type: "lava_shallow", rect: R(19.2, 7.55, 2.6, 0.5) },
    { id: "lava_frost_early", type: "lava_shallow", rect: R(12.2, 14.5, 3.2, 0.5) },
    { id: "lava_frost_hall", type: "lava_shallow", rect: R(36.4, 14.5, 3.2, 0.5) },
    { id: "lava_exit", type: "lava_shallow", rect: R(58, 7.55, 8, 0.5) },
    { id: "water_exit", type: "water_shallow", rect: R(58, 14, 8, 1) },
  ],
  plates: { ember: R(50.6, 7.45, 3.2, 0.6), frost: R(50.6, 14.45, 3.2, 0.6) },
  altar: R(46, 12.4, 2.6, 2.6),
  wispNest: { x: -999, y: -999 },
  chargeBudget: 1,
  score: { starTimeMs: 260_000, starDeaths: 4 },
  levers: [{ id: "gear_a", rect: R(14.5, 6.9, 2.4, 1.2), kind: "gear" }],
  holdGates: [
    {
      id: "ember_holds_frost_hall",
      who: "ember",
      plate: R(24.4, 7.45, 2.6, 0.55),
      rects: [R(44.2, 9, 1.2, 6)],
    },
  ],
  gear: {
    windows: [
      {
        id: "fire",
        openAtMs: 0,
        closeAtMs: 2200,
        solidsWhenClosed: [R(19, 1, 1.2, 7)],
      },
      {
        id: "frost_early",
        openAtMs: 1400,
        closeAtMs: 4200,
        solidsWhenClosed: [R(21, 9, 1.2, 6)],
      },
      {
        id: "frost_real",
        openAtMs: 3600,
        closeAtMs: 200000,
        solidsWhenClosed: [R(32, 9, 1.2, 6)],
      },
    ],
  },
};
