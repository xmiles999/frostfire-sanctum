import type { LevelDocument } from "../sim/types";
import { LEVEL_01 } from "./level01";
import { LEVEL_02 } from "./level02";
import { LEVEL_03 } from "./level03";
import { LEVEL_04 } from "./level04";
import { LEVEL_05 } from "./level05";

export const LEVELS: LevelDocument[] = [LEVEL_01, LEVEL_02, LEVEL_03, LEVEL_04, LEVEL_05];

export function levelById(id: string): LevelDocument {
  return LEVELS.find((level) => level.id === id) ?? LEVEL_01;
}
