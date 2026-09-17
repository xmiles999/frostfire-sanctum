import { ACTOR_H, ACTOR_W } from "../engine/constants";
import type { ActorState, LevelDocument, SimState } from "./types";
import { steamAt } from "./steam";

function makeActor(
  id: ActorState["id"],
  x: number,
  y: number,
): ActorState {
  return {
    id,
    x,
    y,
    vx: 0,
    vy: 0,
    w: ACTOR_W,
    h: ACTOR_H,
    facing: 1,
    onGround: false,
    coyoteMs: 0,
    jumpBufferMs: 0,
    jumpWasHeld: false,
    landMs: 0,
    downed: false,
    invulnMs: 0,
    anim: "idle",
    animTime: 0,
  };
}

export function createSim(level: LevelDocument): SimState {
  const steam = steamAt(0);
  return {
    timeMs: 0,
    status: "playing",
    level,
    ember: makeActor("ember", level.spawns.ember.x, level.spawns.ember.y),
    frost: makeActor("frost", level.spawns.frost.x, level.spawns.frost.y),
    wisp: {
      x: level.wispNest.x,
      y: level.wispNest.y,
      nestX: level.wispNest.x,
      nestY: level.wispNest.y,
      target: null,
      phase: "idle",
      acquireMs: 0,
      lostMs: 0,
      facing: 1,
    },
    steamElapsedMs: 0,
    steamPhase: steam.phase,
    steamPhaseMs: steam.phaseMs,
    plateEmber: false,
    plateFrost: false,
    bothHeldMs: 0,
    doorOpen: false,
    doorPhase: "closed",
    doorMotionMs: 0,
    latchMs: 0,
    bothInExitMs: 0,
    chargeLeft: level.chargeBudget,
    chargeUsed: false,
    deaths: 0,
    rescues: 0,
    rescueMs: 0,
    downedCause: null,
  };
}
