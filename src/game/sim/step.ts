import { rectCenter, rectsOverlap, dist } from "../engine/aabb";
import {
  DOOR_LATCH_MS,
  DOOR_MOTION_MS,
  EMBER_SPEED,
  EXIT_HOLD_MS,
  FROST_SPEED,
  LAVA_SPEED_SCALE,
  MAX_SEPARATION,
  PHYS_DT,
  PLATE_HOLD_MS,
  RESCUE_MS,
  REVIVE_INVULN_MS,
  SEPARATION_SPEED_SCALE,
  TILE,
  WISP_ACQUIRE_MS,
  WISP_LOST_MS,
  WISP_RANGE,
  WISP_SPEED,
} from "../engine/constants";
import { actorRect, integrateActor } from "../engine/physics";
import type { ActorState, Hazard, Intent, PairIntent, SimState } from "./types";
import { steamAt } from "./steam";

function lethalFor(actor: ActorState, type: Hazard["type"], steamLethal: boolean): boolean {
  if (actor.invulnMs > 0 || actor.downed) return false;
  if (type === "lava_shallow") return actor.id === "frost";
  if (type === "water_shallow") return actor.id === "ember";
  if (type === "steam_hot") return actor.id === "frost" && steamLethal;
  if (type === "ice_mist") return actor.id === "ember";
  return false;
}

function downActor(sim: SimState, actor: ActorState, cause: string): void {
  if (actor.downed) return;
  actor.downed = true;
  actor.vx = 0;
  actor.vy = 0;
  actor.anim = "downed";
  sim.deaths += 1;
  sim.downedCause = cause;
}

function solidsNow(sim: SimState) {
  return sim.doorOpen ? sim.level.solids : [...sim.level.solids, ...sim.level.gatedSolids];
}

function stepWisp(sim: SimState, dt: number): void {
  const w = sim.wisp;
  const emberC = rectCenter(actorRect(sim.ember));
  const frostC = rectCenter(actorRect(sim.frost));
  const dEmber = dist(w.x, w.y, emberC.x, emberC.y);
  const dFrost = dist(w.x, w.y, frostC.x, frostC.y);

  let nearest: { id: "ember" | "frost"; d: number } | null = null;
  if (!sim.ember.downed && dEmber <= WISP_RANGE) nearest = { id: "ember", d: dEmber };
  if (!sim.frost.downed && dFrost <= WISP_RANGE && (nearest === null || dFrost < nearest.d)) {
    nearest = { id: "frost", d: dFrost };
  }

  if (w.phase === "idle") {
    if (nearest) {
      w.phase = "acquire";
      w.target = nearest.id;
      w.acquireMs = WISP_ACQUIRE_MS;
    }
  } else if (w.phase === "acquire") {
    w.acquireMs -= dt * 1000;
    if (nearest) w.target = nearest.id;
    if (w.acquireMs <= 0) w.phase = "chase";
  } else if (w.phase === "chase") {
    if (!nearest) {
      w.phase = "lost";
      w.lostMs = WISP_LOST_MS;
      w.target = null;
    } else {
      if (w.target && nearest.id !== w.target) {
        const current = w.target === "ember" ? dEmber : dFrost;
        if (nearest.d + TILE >= current) nearest = { id: w.target, d: current };
      }
      w.target = nearest.id;
      const t = nearest.id === "ember" ? emberC : frostC;
      const mag = dist(w.x, w.y, t.x, t.y) || 1;
      w.x += ((t.x - w.x) / mag) * WISP_SPEED * dt;
      w.y += ((t.y - w.y) / mag) * WISP_SPEED * dt;
      w.facing = t.x >= w.x ? 1 : -1;
    }
  } else if (w.phase === "lost") {
    w.lostMs -= dt * 1000;
    const mag = dist(w.x, w.y, w.nestX, w.nestY) || 1;
    w.x += ((w.nestX - w.x) / mag) * WISP_SPEED * dt;
    w.y += ((w.nestY - w.y) / mag) * WISP_SPEED * dt;
    if (w.lostMs <= 0) {
      w.x = w.nestX;
      w.y = w.nestY;
      w.phase = "idle";
    }
  }

  const wispHit = { x: w.x - 14, y: w.y - 14, w: 28, h: 28 };
  if (rectsOverlap(wispHit, actorRect(sim.frost))) {
    downActor(sim, sim.frost, "wisp");
  }
}

function applyHazards(sim: SimState): void {
  const steamLethal = sim.steamPhase === "lethal";
  for (const actor of [sim.ember, sim.frost]) {
    for (const h of sim.level.hazards) {
      if (!rectsOverlap(actorRect(actor), h.rect)) continue;
      if (lethalFor(actor, h.type, steamLethal)) {
        downActor(sim, actor, h.id);
      }
    }
  }
}

function inLava(sim: SimState, actor: ActorState): boolean {
  return sim.level.hazards.some(
    (h) => h.type === "lava_shallow" && rectsOverlap(actorRect(actor), h.rect),
  );
}

function actorStandingOnPlate(actor: ActorState, plate: SimState["level"]["plates"]["ember"]): boolean {
  if (actor.downed || !actor.onGround) return false;
  const footX = actor.x + actor.w / 2;
  const footY = actor.y + actor.h;
  const horizontalInset = Math.min(10, plate.w * 0.12);
  return (
    footX >= plate.x + horizontalInset &&
    footX <= plate.x + plate.w - horizontalInset &&
    footY >= plate.y - 10 &&
    footY <= plate.y + plate.h + 10
  );
}

function latchDoor(sim: SimState): void {
  sim.doorOpen = true;
  sim.doorPhase = "opening";
  sim.doorMotionMs = DOOR_MOTION_MS;
  sim.latchMs = DOOR_LATCH_MS;
}

function stepDoor(sim: SimState, dtMs: number): void {
  if (!sim.doorOpen) return;

  if (sim.doorPhase === "opening") {
    sim.doorMotionMs = Math.max(0, sim.doorMotionMs - dtMs);
    if (sim.doorMotionMs === 0) sim.doorPhase = "open";
  }

  sim.latchMs = Math.max(0, sim.latchMs - dtMs);
  if (sim.latchMs > 0) return;

  const occupyingDoor = sim.level.gatedSolids.some(
    (s) => rectsOverlap(actorRect(sim.ember), s) || rectsOverlap(actorRect(sim.frost), s),
  );
  if (occupyingDoor) {
    sim.doorPhase = "open";
    sim.doorMotionMs = 0;
    return;
  }

  if (sim.doorPhase !== "closing") {
    sim.doorPhase = "closing";
    sim.doorMotionMs = DOOR_MOTION_MS;
  }
  sim.doorMotionMs = Math.max(0, sim.doorMotionMs - dtMs);
  if (sim.doorMotionMs === 0) {
    sim.doorOpen = false;
    sim.doorPhase = "closed";
  }
}

function stepActor(
  sim: SimState,
  actor: ActorState,
  intent: Intent,
  baseSpeed: number,
  dt: number,
): void {
  let speed = baseSpeed;
  if (actor.id === "ember" && inLava(sim, actor)) speed *= LAVA_SPEED_SCALE;
  if (sim.status === "playing" || sim.status === "rescue_window") {
    const midX = (sim.ember.x + sim.frost.x) / 2;
    const sep = Math.abs(sim.ember.x - sim.frost.x);
    if (sep > MAX_SEPARATION) {
      const farther = Math.abs(actor.x - midX) >= Math.abs((actor === sim.ember ? sim.frost.x : sim.ember.x) - midX);
      if (farther) speed *= SEPARATION_SPEED_SCALE;
    }
  }
  integrateActor(
    actor,
    solidsNow(sim),
    dt,
    speed,
    intent.left,
    intent.right,
    intent.jump || intent.up,
  );
  actor.invulnMs = Math.max(0, actor.invulnMs - dt * 1000);
  actor.animTime += dt;
  if (actor.downed) actor.anim = "downed";
  else if (!actor.onGround) actor.anim = actor.vy < 0 ? "jump" : "fall";
  else if (actor.landMs > 0) actor.anim = "land";
  else if (Math.abs(actor.vx) > 8) actor.anim = "walk";
  else if (intent.interact) actor.anim = "interact";
  else actor.anim = "idle";
}

function maybeRescue(sim: SimState, intents: PairIntent): void {
  const downed = sim.ember.downed ? sim.ember : sim.frost.downed ? sim.frost : null;
  const living = sim.ember.downed ? (sim.frost.downed ? null : sim.frost) : sim.frost.downed ? sim.ember : null;
  if (!downed || !living) return;
  const intent = living.id === "ember" ? intents.ember : intents.frost;
  if (intent.interact && rectsOverlap(actorRect(living), sim.level.altar) && sim.chargeLeft > 0) {
    downed.downed = false;
    downed.invulnMs = REVIVE_INVULN_MS;
    downed.anim = "idle";
    sim.chargeLeft -= 1;
    sim.chargeUsed = true;
    sim.rescues += 1;
    sim.status = "playing";
    sim.rescueMs = 0;
  }
}

export function stepSim(sim: SimState, intents: PairIntent, dt = PHYS_DT): void {
  if (sim.status === "paused" || sim.status === "failed" || sim.status === "cleared") return;

  sim.timeMs += dt * 1000;
  const steam = steamAt(sim.timeMs);
  sim.steamPhase = steam.phase;
  sim.steamPhaseMs = steam.phaseMs;

  stepActor(sim, sim.ember, intents.ember, EMBER_SPEED, dt);
  stepActor(sim, sim.frost, intents.frost, FROST_SPEED, dt);
  stepWisp(sim, dt);
  applyHazards(sim);

  sim.plateEmber = actorStandingOnPlate(sim.ember, sim.level.plates.ember);
  sim.plateFrost = actorStandingOnPlate(sim.frost, sim.level.plates.frost);
  if (sim.plateEmber && sim.plateFrost) {
    sim.bothHeldMs += dt * 1000;
    if (sim.bothHeldMs >= PLATE_HOLD_MS && !sim.doorOpen) {
      latchDoor(sim);
    }
  } else {
    sim.bothHeldMs = 0;
  }
  stepDoor(sim, dt * 1000);

  const emberExit = rectsOverlap(actorRect(sim.ember), sim.level.exits.ember) && !sim.ember.downed;
  const frostExit = rectsOverlap(actorRect(sim.frost), sim.level.exits.frost) && !sim.frost.downed;
  if (emberExit && frostExit) {
    sim.bothInExitMs += dt * 1000;
    if (sim.bothInExitMs >= EXIT_HOLD_MS) sim.status = "cleared";
  } else {
    sim.bothInExitMs = 0;
  }

  const anyDown = sim.ember.downed || sim.frost.downed;
  const bothDown = sim.ember.downed && sim.frost.downed;
  if (bothDown) {
    sim.status = "failed";
  } else if (anyDown) {
    if (sim.status === "playing") {
      sim.status = "rescue_window";
      sim.rescueMs = RESCUE_MS;
    } else if (sim.status === "rescue_window") {
      sim.rescueMs -= dt * 1000;
      if (sim.rescueMs <= 0) sim.status = "failed";
      else maybeRescue(sim, intents);
    }
  } else if (sim.status === "rescue_window") {
    sim.status = "playing";
  }
}

export function starsFor(sim: SimState): 1 | 2 | 3 {
  if (sim.status !== "cleared") return 1;
  const t = sim.timeMs;
  if (sim.deaths === 0 && !sim.chargeUsed && t <= sim.level.score.starTimeMs) return 3;
  if (sim.deaths <= sim.level.score.starDeaths) return 2;
  return 1;
}

export { TILE };
