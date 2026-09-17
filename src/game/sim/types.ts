import type { Rect } from "../engine/aabb";

export type ActorId = "ember" | "frost";

export type ActorAnim =
  | "idle"
  | "walk"
  | "jump"
  | "fall"
  | "land"
  | "hurt"
  | "downed"
  | "interact";

export type SimStatus = "playing" | "paused" | "rescue_window" | "failed" | "cleared";

export type HazardType =
  | "lava_shallow"
  | "water_shallow"
  | "steam_hot"
  | "ice_mist";

export type SteamPhase = "safe" | "telegraph" | "lethal";

export type WispPhase = "idle" | "acquire" | "chase" | "lost";

export interface Intent {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  interact: boolean;
  jump: boolean;
}

export const EMPTY_INTENT: Intent = {
  left: false,
  right: false,
  up: false,
  down: false,
  interact: false,
  jump: false,
};

export interface ActorState {
  id: ActorId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  facing: 1 | -1;
  onGround: boolean;
  coyoteMs: number;
  jumpBufferMs: number;
  downed: boolean;
  invulnMs: number;
  anim: ActorAnim;
  animTime: number;
}

export interface WispState {
  x: number;
  y: number;
  nestX: number;
  nestY: number;
  target: ActorId | null;
  phase: WispPhase;
  acquireMs: number;
  lostMs: number;
  facing: 1 | -1;
}

export interface Hazard {
  id: string;
  type: HazardType;
  rect: Rect;
}

export interface LevelDocument {
  id: string;
  title: string;
  tile: number;
  size: { w: number; h: number };
  spawns: { ember: { x: number; y: number }; frost: { x: number; y: number } };
  exits: { ember: Rect; frost: Rect };
  solids: Rect[];
  gatedSolids: Rect[];
  hazards: Hazard[];
  plates: { ember: Rect; frost: Rect };
  altar: Rect;
  wispNest: { x: number; y: number };
  chargeBudget: number;
  score: { starTimeMs: number; starDeaths: number };
}

export interface SimState {
  timeMs: number;
  status: SimStatus;
  level: LevelDocument;
  ember: ActorState;
  frost: ActorState;
  wisp: WispState;
  steamElapsedMs: number;
  steamPhase: SteamPhase;
  steamPhaseMs: number;
  plateEmber: boolean;
  plateFrost: boolean;
  bothHeldMs: number;
  doorOpen: boolean;
  latchMs: number;
  bothInExitMs: number;
  chargeLeft: number;
  chargeUsed: boolean;
  deaths: number;
  rescues: number;
  rescueMs: number;
  downedCause: string | null;
}

export interface PairIntent {
  ember: Intent;
  frost: Intent;
}
