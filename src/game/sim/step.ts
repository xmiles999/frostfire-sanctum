import { dist, rectCenter, rectsOverlap, type Rect } from "../engine/aabb";
import {
  BRIDGE_BURN_MS,
  BRIDGE_STAND_IGNITE_MS,
  CRATE_PUSH_SCALE,
  DOOR_LATCH_MS,
  DOOR_MOTION_MS,
  EMBER_SPEED,
  EXIT_HOLD_MS,
  FALL_SPEED_MAX,
  FROST_SPEED,
  GRAVITY,
  LAVA_SPEED_SCALE,
  MAX_SEPARATION,
  PHASE_LOCK_MS,
  PHYS_DT,
  PLATE_HOLD_MS,
  RESCUE_MS,
  REVIVE_INVULN_MS,
  SEPARATION_SPEED_SCALE,
  TILE,
  TIDE_LATCH_MS,
  WISP_ACQUIRE_MS,
  WISP_LOST_MS,
  WISP_PATROL_AMP,
  WISP_PATROL_SPEED,
  WISP_RANGE,
  WISP_SPEED,
  PRECISION_SPEED_SCALE,
} from "../engine/constants";
import { actorRect, integrateActor } from "../engine/physics";
import type { ActorState, Hazard, Intent, PairIntent, SimState } from "./types";
import { steamAt } from "./steam";
import { activeHazards, applyOneWays, crateRect, onIce, runesReady, solidsNow, standingOnPlate } from "./world";
import { updateActorAnimation } from "./animation";
import { stepFragilePlatforms } from "./fragile";
import { canIgnite, nearInteraction, notify } from "./interactions";

function lethalFor(actor: ActorState, type: Hazard["type"], steamLethal: boolean): boolean {
  if (actor.invulnMs > 0 || actor.downed) return false;
  if (type === "lava_shallow" || type === "lava_deep") return actor.id === "frost";
  if (type === "water_shallow" || type === "water_deep") return actor.id === "ember";
  if (type === "steam_hot") return actor.id === "frost" && steamLethal;
  if (type === "ice_mist") return actor.id === "ember";
  return false;
}

function downActor(sim: SimState, actor: ActorState, cause: string): void {
  if (actor.downed) return;
  actor.downed = true;
  actor.vx = 0;
  actor.vy = 0;
  actor.anim = "hurt";
  actor.animTime = 0;
  sim.deaths += 1;
  sim.downedCause = cause;
  notify(sim, `${actor.id === "ember" ? "烬" : "朔"}倒地 · 同伴到祭坛救援`);
}

function stepWisp(sim: SimState, dt: number): void {
  const w = sim.wisp;
  if (w.nestX < 0) return;
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
    } else {
      if (w.x >= w.nestX + WISP_PATROL_AMP) w.facing = -1;
      else if (w.x <= w.nestX - WISP_PATROL_AMP) w.facing = 1;
      w.x += w.facing * WISP_PATROL_SPEED * dt;
      w.y += (w.nestY - w.y) * Math.min(1, 6 * dt);
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
    for (const h of activeHazards(sim)) {
      if (!rectsOverlap(actorRect(actor), h.rect)) continue;
      if (lethalFor(actor, h.type, steamLethal)) {
        downActor(sim, actor, h.id);
      }
    }
  }
}

function inLava(sim: SimState, actor: ActorState): boolean {
  return activeHazards(sim).some(
    (h) => (h.type === "lava_shallow" || h.type === "lava_deep") && rectsOverlap(actorRect(actor), h.rect),
  );
}

function actorStandingOnPlate(actor: ActorState, plate: Rect): boolean {
  return standingOnPlate(actor, plate);
}

function crateOnPlate(crate: SimState["crates"][number], plate: Rect): boolean {
  const footX = crate.x + crate.w / 2;
  const footY = crate.y + crate.h;
  return (
    footX >= plate.x &&
    footX <= plate.x + plate.w &&
    footY >= plate.y - 12 &&
    footY <= plate.y + plate.h + 28
  );
}

function latchDoor(sim: SimState, latchMs = DOOR_LATCH_MS): void {
  if (!runesReady(sim)) return;
  if (sim.level.puzzle === "burn" && sim.level.bridges?.some(spec => spec.oily && !sim.bridges.find(b => b.id === spec.id)?.collapsed)) return;
  sim.doorOpen = true;
  sim.doorPhase = "opening";
  sim.doorMotionMs = DOOR_MOTION_MS;
  sim.latchMs = latchMs;
  notify(sim, "出口已开启 · 双人进入同色门");
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
  let speed = baseSpeed * (intent.down ? PRECISION_SPEED_SCALE : 1);
  actor.pushing = false;
  actor.interactMs = Math.max(0, actor.interactMs - dt * 1000);
  if (actor.id === "ember" && inLava(sim, actor)) speed *= LAVA_SPEED_SCALE;
  if (sim.status === "playing" || sim.status === "rescue_window") {
    const midX = (sim.ember.x + sim.frost.x) / 2;
    const sep = Math.abs(sim.ember.x - sim.frost.x);
    if (sep > MAX_SEPARATION) {
      const farther =
        Math.abs(actor.x - midX) >= Math.abs((actor === sim.ember ? sim.frost.x : sim.ember.x) - midX);
      if (farther) speed *= SEPARATION_SPEED_SCALE;
    }
  }
  const ice = actor.id === "frost" && onIce(sim, actor.x + actor.w / 2, actor.y + actor.h);
  integrateActor(
    actor,
    solidsNow(sim),
    dt,
    speed,
    intent.left,
    intent.right,
    intent.jump || intent.up,
    ice,
  );
  applyOneWays(sim, actor);
  actor.invulnMs = Math.max(0, actor.invulnMs - dt * 1000);
  const worldH = sim.level.size.h * TILE;
  if (!actor.downed && actor.y > worldH + TILE) {
    downActor(sim, actor, "void");
  }
}

function waterTopForCrate(sim: SimState, crate: SimState["crates"][number]): number | null {
  let top: number | null = null;
  for (const h of activeHazards(sim)) {
    if (h.type !== "water_shallow" && h.type !== "water_deep") continue;
    if (crate.x + crate.w < h.rect.x || crate.x > h.rect.x + h.rect.w) continue;
    top = top === null ? h.rect.y : Math.min(top, h.rect.y);
  }
  return top;
}

function stepCrates(sim: SimState, dt: number): void {
  const solids = solidsNow(sim);
  for (const crate of sim.crates) {
    crate.vy += GRAVITY * dt;
    if (crate.vy > FALL_SPEED_MAX) crate.vy = FALL_SPEED_MAX;
    const waterTop = waterTopForCrate(sim, crate);
    if (waterTop !== null && crate.y + crate.h > waterTop) {
      if (sim.tideLevel === 2 && crate.density > 1.05) {
        crate.vy = Math.min(crate.vy, 220);
      } else if (sim.tideLevel >= 1) {
        crate.vy = 0;
        crate.y = waterTop - crate.h + 12;
      }
    }
    for (const actor of [sim.ember, sim.frost]) {
      if (actor.downed || !rectsOverlap(actorRect(actor), crateRect(crate))) continue;
      const actorBottom = actor.y + actor.h;
      if (actor.vy >= 0 && actorBottom <= crate.y + 16 && actorBottom >= crate.y - 10) {
        actor.y = crate.y - actor.h;
        actor.vy = 0;
        actor.onGround = true;
        continue;
      }
      if (Math.abs(actor.vx) > 8) {
        actor.pushing = true;
        crate.vx = actor.vx * CRATE_PUSH_SCALE;
        if (actor.vx > 0) actor.x = crate.x - actor.w;
        else actor.x = crate.x + crate.w;
      }
    }
    crate.x += crate.vx * dt;
    crate.y += crate.vy * dt;
    crate.vx *= onIce(sim, crate.x + crate.w / 2, crate.y + crate.h) ? 0.992 : 0.82;
    let grounded = false;
    for (const s of solids) {
      if (!rectsOverlap(crateRect(crate), s)) continue;
      if (crate.vy >= 0 && crate.y + crate.h > s.y && crate.y < s.y) {
        crate.y = s.y - crate.h;
        crate.vy = 0;
        grounded = true;
      } else if (crate.vx > 0) crate.x = s.x - crate.w;
      else if (crate.vx < 0) crate.x = s.x + s.w;
    }
    crate.onGround = grounded;
    const worldW = sim.level.size.w * TILE;
    crate.x = Math.max(TILE, Math.min(worldW - TILE - crate.w, crate.x));
  }
}

function interactEdge(actor: ActorState, intent: Intent): boolean {
  const pressed = intent.interact && !actor.interactHeld;
  actor.interactHeld = intent.interact;
  return pressed && !actor.downed;
}

function hittingLever(actor: ActorState, lever: { rect: Rect }): boolean {
  if (actor.downed) return false;
  return rectsOverlap(actorRect(actor), {
    x: lever.rect.x - 8,
    y: lever.rect.y - 12,
    w: lever.rect.w + 16,
    h: lever.rect.h + 24,
  });
}

function stepLevers(sim: SimState, intents: PairIntent): void {
  const emberEdge = interactEdge(sim.ember, intents.ember);
  const frostEdge = interactEdge(sim.frost, intents.frost);
  for (const lever of sim.level.levers ?? []) {
    const touching = hittingLever(sim.ember, lever) || hittingLever(sim.frost, lever);
    const entered = touching && !sim.leverInside[lever.id];
    sim.leverInside[lever.id] = touching;
    const used =
      entered ||
      (emberEdge && nearInteraction(sim.ember, lever.rect)) ||
      (frostEdge && nearInteraction(sim.frost, lever.rect));
    if (!used) continue;
    for (const actor of [sim.ember, sim.frost]) {
      if (nearInteraction(actor, lever.rect)) actor.interactMs = 300;
    }
    if (lever.kind === "tide") {
      sim.tideLevel = sim.tideLevel === 0 ? 2 : sim.tideLevel === 2 ? 1 : 0;
      notify(sim, `潮位已切换 · ${["浅水", "中水", "深水"][sim.tideLevel]}`);
    }
    if (lever.kind === "gear") {
      sim.gearArmedMs = 0;
      notify(sim, "齿轮周期启动 · 朔准备穿首闸");
    }
  }
  if (emberEdge && sim.level.bridges) {
    for (const bridge of sim.level.bridges) {
      if (canIgnite(sim.ember, bridge)) {
        const rt = sim.bridges.find((b) => b.id === bridge.id);
        if (rt && !rt.ignited && !rt.collapsed) {
          rt.ignited = true;
          sim.ember.interactMs = 400;
          notify(sim, "油桥已点燃 · 等待灰烬形成");
        }
      }
    }
  }
}

function stepBridges(sim: SimState, dt: number): void {
  for (const spec of sim.level.bridges ?? []) {
    const rt = sim.bridges.find((b) => b.id === spec.id);
    if (!rt || rt.collapsed) continue;
    if (
      !rt.ignited &&
      !sim.ember.downed &&
      actorStandingOnPlate(sim.ember, spec.rect)
    ) {
      rt.burnMs += dt * 1000;
      if (rt.burnMs >= BRIDGE_STAND_IGNITE_MS) {
        rt.ignited = true;
        rt.burnMs = 0;
      }
    }
    if (rt.ignited) {
      rt.burnMs += dt * 1000;
      if (rt.burnMs >= BRIDGE_BURN_MS) {
        rt.collapsed = true;
        if (spec.ashRect) sim.ashSolids.push(spec.ashRect);
        const bothOn =
          rectsOverlap(actorRect(sim.ember), spec.rect) && rectsOverlap(actorRect(sim.frost), spec.rect);
        if (bothOn) {
          downActor(sim, sim.ember, `bridge_${spec.id}`);
          downActor(sim, sim.frost, `bridge_${spec.id}`);
        } else {
          for (const a of [sim.ember, sim.frost]) {
            if (rectsOverlap(actorRect(a), spec.rect) && a.y + a.h <= spec.rect.y + 12) {
              a.onGround = false;
            }
          }
        }
      }
    }
  }
}

function stepPhase(sim: SimState, dt: number): void {
  if (sim.level.puzzle !== "phase") return;
  sim.phaseLockMs = Math.max(0, sim.phaseLockMs - dt * 1000);
  for (const plate of sim.level.extraPlates ?? []) {
    const actor = plate.who === "frost" ? sim.frost : sim.ember;
    const held = actorStandingOnPlate(actor, plate.rect);
    sim.extraHeld[plate.id] = held;
    if (!held) sim.phasePlateLatched[plate.id] = false;
    sim.extraHeldMs[plate.id] = held && !sim.phasePlateLatched[plate.id] && sim.phaseLockMs === 0
      ? (sim.extraHeldMs[plate.id] ?? 0) + dt * 1000 : 0;
    if ((sim.extraHeldMs[plate.id] ?? 0) >= PLATE_HOLD_MS) {
      sim.phase = sim.phase === 0 ? 1 : 0;
      sim.phaseLockMs = PHASE_LOCK_MS;
      sim.extraHeldMs[plate.id] = 0;
      sim.phasePlateLatched[plate.id] = true;
      notify(sim, sim.phase === 0 ? "火闸已开 · 烬可以进入" : "水闸已开 · 朔可以进入");
    }
  }
}

function stepGear(sim: SimState, dt: number): void {
  if (sim.gearArmedMs === null) return;
  sim.gearArmedMs += dt * 1000;
  if (sim.level.gear?.cycleMs) sim.gearArmedMs %= sim.level.gear.cycleMs;
}

function stepPuzzles(sim: SimState, intents: PairIntent, dt: number): void {
  stepLevers(sim, intents);
  stepCrates(sim, dt);
  stepBridges(sim, dt);
  stepPhase(sim, dt);
  stepGear(sim, dt);

  const puzzle = sim.level.puzzle ?? "dual_plates";
  if (puzzle === "dual_plates" || puzzle === "burn" || puzzle === "gear" || puzzle === "phase") {
    sim.plateEmber = actorStandingOnPlate(sim.ember, sim.level.plates.ember);
    sim.plateFrost = actorStandingOnPlate(sim.frost, sim.level.plates.frost);
    if (sim.plateEmber && sim.plateFrost) {
      sim.bothHeldMs += dt * 1000;
      if (sim.bothHeldMs >= PLATE_HOLD_MS && !sim.doorOpen) latchDoor(sim, sim.level.doorLatchMs ?? DOOR_LATCH_MS);
    } else {
      sim.bothHeldMs = 0;
    }
  }
  if (puzzle === "tide" && sim.level.tide) {
    const crate = sim.crates[0];
    const pressed = crate ? crateOnPlate(crate, sim.level.tide.wellPlate) && sim.tideLevel === 2 : false;
    if (pressed && !sim.doorOpen) latchDoor(sim, sim.level.doorLatchMs ?? TIDE_LATCH_MS);
  }

  if (puzzle === "tide") {
    sim.puzzleHint = sim.tideLevel === 0 ? "潮位浅" : sim.tideLevel === 1 ? "潮位中" : "潮位深";
  } else if (puzzle === "burn") {
    const mid = sim.bridges.find((b) => b.id.includes("mid") || b.id.includes("2"));
    sim.puzzleHint = mid?.collapsed ? "灰烬" : mid?.ignited ? "燃烧" : "栈道";
  } else if (puzzle === "phase") {
    sim.puzzleHint = sim.phase === 0 ? "熔岩闸" : "水闸";
  } else if (puzzle === "gear") {
    if (sim.gearArmedMs === null) sim.puzzleHint = "齿轮停";
    else sim.puzzleHint = `齿轮周期 ${(sim.gearArmedMs / 1000).toFixed(1)}s / ${((sim.level.gear?.cycleMs ?? 10000) / 1000).toFixed(0)}s`;
  } else {
    sim.puzzleHint = "";
  }
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
    downed.animTime = 0;
    living.interactMs = 400;
    sim.chargeLeft -= 1;
    sim.chargeUsed = true;
    sim.rescues += 1;
    sim.status = "playing";
    sim.rescueMs = 0;
    notify(sim, "救援成功 · 短暂无敌，尽快离开危险区");
  }
}

export function stepSim(sim: SimState, intents: PairIntent, dt = PHYS_DT): void {
  if (sim.status === "paused" || sim.status === "failed" || sim.status === "cleared") return;

  sim.timeMs += dt * 1000;
  if (sim.feedback) {
    sim.feedback.remainingMs -= dt * 1000;
    if (sim.feedback.remainingMs <= 0) sim.feedback = null;
  }
  const steam = steamAt(sim.timeMs);
  sim.steamPhase = steam.phase;
  sim.steamPhaseMs = steam.phaseMs;

  stepActor(sim, sim.ember, intents.ember, EMBER_SPEED, dt);
  stepActor(sim, sim.frost, intents.frost, FROST_SPEED, dt);
  for (const gem of sim.level.collectibles ?? []) {
    const actor = sim[gem.who];
    if (!actor.downed && !sim.collected.includes(gem.id) && rectsOverlap(actorRect(actor), gem.rect)) {
      sim.collected.push(gem.id);
      notify(sim, `${gem.who === "ember" ? "烬" : "朔"}取得${gem.required ? "符文" : "晶石"} · ${sim.collected.length}/${sim.level.collectibles?.length ?? 0}`);
    }
  }
  stepPuzzles(sim, intents, dt);
  stepFragilePlatforms(sim, dt * 1000);
  stepWisp(sim, dt);
  applyHazards(sim);
  stepDoor(sim, dt * 1000);

  const emberExit = rectsOverlap(actorRect(sim.ember), sim.level.exits.ember) && !sim.ember.downed;
  const frostExit = rectsOverlap(actorRect(sim.frost), sim.level.exits.frost) && !sim.frost.downed;
  if (emberExit && frostExit && runesReady(sim) && sim.doorOpen) {
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
  updateActorAnimation(sim.ember, dt);
  updateActorAnimation(sim.frost, dt);
}

export function starsFor(sim: SimState): 1 | 2 | 3 {
  if (sim.status !== "cleared") return 1;
  const t = sim.timeMs;
  const allGems = (sim.level.collectibles ?? []).every(g => sim.collected.includes(g.id));
  if (sim.deaths === 0 && !sim.chargeUsed && t <= sim.level.score.starTimeMs && allGems) return 3;
  if (sim.deaths <= sim.level.score.starDeaths) return 2;
  return 1;
}

export { TILE, activeHazards, solidsNow };
