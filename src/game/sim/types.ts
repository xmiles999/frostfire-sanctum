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
  | "lava_deep"
  | "water_shallow"
  | "water_deep"
  | "steam_hot"
  | "ice_mist";

export type PuzzleKind = "dual_plates" | "tide" | "burn" | "phase" | "gear";

export type TideLevel = 0 | 1 | 2;

export type SteamPhase = "safe" | "telegraph" | "lethal";

export type WispPhase = "idle" | "acquire" | "chase" | "lost";

export type DoorPhase = "closed" | "opening" | "open" | "closing";

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
  jumpWasHeld: boolean;
  landMs: number;
  downed: boolean;
  invulnMs: number;
  anim: ActorAnim;
  animTime: number;
  interactHeld: boolean;
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

export interface CrateSpec {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  density: number;
}

export interface CrateState {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  density: number;
  onGround: boolean;
}

export interface LeverSpec {
  id: string;
  rect: Rect;
  kind: "tide" | "gear";
}

export interface TideSpec {
  wellPlate: Rect;
  ice: Rect[];
  floatIce: Rect[];
  shallowWater: Hazard[];
  midWater: Hazard[];
  deepWater: Hazard[];
  flood: Hazard[];
}

export interface BridgeSeg {
  id: string;
  rect: Rect;
  oily: boolean;
  ashRect: Rect | null;
}

export interface BridgeRuntime {
  id: string;
  ignited: boolean;
  burnMs: number;
  collapsed: boolean;
}

export interface PhaseGate {
  id: string;
  rects: Rect[];
  side: "lava" | "water";
}

export interface OneWay {
  rect: Rect;
  dir: 1 | -1;
}

export interface ExtraPlate {
  id: string;
  rect: Rect;
  who: "ember" | "frost" | "any";
}

/** Gate stays solid unless the matching actor is standing on the plate. */
export interface HoldGate {
  id: string;
  plate: Rect;
  who: "ember" | "frost" | "any";
  rects: Rect[];
}

export interface GearWindow {
  id: string;
  openAtMs: number;
  closeAtMs: number;
  solidsWhenClosed: Rect[];
}

export interface GearSpec {
  windows: GearWindow[];
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
  puzzle?: PuzzleKind;
  crates?: CrateSpec[];
  levers?: LeverSpec[];
  tide?: TideSpec;
  bridges?: BridgeSeg[];
  phaseGates?: PhaseGate[];
  oneWays?: OneWay[];
  extraPlates?: ExtraPlate[];
  holdGates?: HoldGate[];
  gear?: GearSpec;
  doorLatchMs?: number;
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
  doorPhase: DoorPhase;
  doorMotionMs: number;
  latchMs: number;
  bothInExitMs: number;
  chargeLeft: number;
  chargeUsed: boolean;
  deaths: number;
  rescues: number;
  rescueMs: number;
  downedCause: string | null;
  crates: CrateState[];
  tideLevel: TideLevel;
  bridges: BridgeRuntime[];
  ashSolids: Rect[];
  phase: 0 | 1;
  phaseLockMs: number;
  extraHeld: Record<string, boolean>;
  extraHeldMs: Record<string, number>;
  gearArmedMs: number | null;
  puzzleHint: string;
}

export interface PairIntent {
  ember: Intent;
  frost: Intent;
}
