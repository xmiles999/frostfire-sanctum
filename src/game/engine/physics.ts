import type { Rect } from "./aabb";
import { rectsOverlap } from "./aabb";
import {
  COYOTE_MS,
  FALL_SPEED_MAX,
  GRAVITY,
  ICE_ACCEL,
  ICE_MAX_SCALE,
  ICE_SLIDE_DRAG,
  JUMP_BUFFER_MS,
  JUMP_RELEASE_MULTIPLIER,
  JUMP_SPEED,
  LAND_RECOVERY_MS,
  MOVE_ACCEL,
  MOVE_BRAKE,
  FALL_GRAVITY_SCALE,
} from "./constants";
import type { ActorState } from "../sim/types";

export function actorRect(a: Pick<ActorState, "x" | "y" | "w" | "h">): Rect {
  return { x: a.x, y: a.y, w: a.w, h: a.h };
}

function resolveAxis(
  a: ActorState,
  solids: Rect[],
  dx: number,
  dy: number,
): boolean {
  a.x += dx;
  a.y += dy;
  let hit = false;
  // Only the nearest overlapping slab; resolving every hit in one pass teleports through stacked floors.
  let best: Rect | null = null;
  let bestDist = Infinity;
  for (const s of solids) {
    if (!rectsOverlap(actorRect(a), s)) continue;
    hit = true;
    let d = Infinity;
    if (dx > 0) d = a.x + a.w - s.x;
    else if (dx < 0) d = s.x + s.w - a.x;
    else if (dy > 0) d = a.y + a.h - s.y;
    else if (dy < 0) d = s.y + s.h - a.y;
    if (d >= 0 && d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  if (!best) return hit;
  if (dx > 0) a.x = best.x - a.w;
  else if (dx < 0) a.x = best.x + best.w;
  if (dy > 0) a.y = best.y - a.h;
  else if (dy < 0) a.y = best.y + best.h;
  return hit;
}

export function integrateActor(
  a: ActorState,
  solids: Rect[],
  dt: number,
  speed: number,
  wantLeft: boolean,
  wantRight: boolean,
  wantJump: boolean,
  ice = false,
): void {
  if (a.downed) {
    a.vx = 0;
    a.vy = 0;
    a.jumpWasHeld = wantJump;
    return;
  }

  const wasGrounded = a.onGround;
  const jumpPressed = wantJump && !a.jumpWasHeld;
  const jumpReleased = !wantJump && a.jumpWasHeld;
  a.jumpWasHeld = wantJump;

  const dir = (wantRight ? 1 : 0) - (wantLeft ? 1 : 0);
  a.moveDir = dir as -1 | 0 | 1;
  if (dir !== 0) a.facing = dir as 1 | -1;
  if (ice) {
    a.vx += dir * ICE_ACCEL * dt;
    if (dir === 0) {
      const drag = ICE_SLIDE_DRAG * dt;
      if (Math.abs(a.vx) <= drag) a.vx = 0;
      else a.vx -= Math.sign(a.vx) * drag;
    }
    const cap = speed * ICE_MAX_SCALE;
    if (a.vx > cap) a.vx = cap;
    if (a.vx < -cap) a.vx = -cap;
  } else {
    const target = dir * speed;
    const rate = dir === 0 ? MOVE_BRAKE : MOVE_ACCEL;
    const delta = target - a.vx;
    a.vx += Math.sign(delta) * Math.min(Math.abs(delta), rate * dt);
  }

  if (jumpPressed) a.jumpBufferMs = JUMP_BUFFER_MS;
  else a.jumpBufferMs = Math.max(0, a.jumpBufferMs - dt * 1000);

  if (a.onGround) a.coyoteMs = COYOTE_MS;
  else a.coyoteMs = Math.max(0, a.coyoteMs - dt * 1000);

  a.vy += GRAVITY * (a.vy > 0 ? FALL_GRAVITY_SCALE : 1) * dt;
  if (a.vy > FALL_SPEED_MAX) a.vy = FALL_SPEED_MAX;

  if (a.jumpBufferMs > 0 && a.coyoteMs > 0) {
    a.vy = -JUMP_SPEED;
    a.onGround = false;
    a.coyoteMs = 0;
    a.jumpBufferMs = 0;
  }

  if (jumpReleased && a.vy < 0) {
    a.vy *= JUMP_RELEASE_MULTIPLIER;
  }

  if (resolveAxis(a, solids, a.vx * dt, 0)) a.vx = 0;
  const impactSpeed = a.vy;
  const yHit = resolveAxis(a, solids, 0, a.vy * dt);
  if (yHit && a.vy > 0) {
    a.onGround = true;
    a.vy = 0;
  } else if (yHit && a.vy < 0) {
    a.vy = 0;
    a.onGround = false;
  } else if (!yHit) {
    a.onGround = false;
  }

  if (!wasGrounded && a.onGround) {
    a.landMs = LAND_RECOVERY_MS;
    a.landImpact = Math.min(1, Math.max(0.25, impactSpeed / FALL_SPEED_MAX));
  }
  else a.landMs = Math.max(0, a.landMs - dt * 1000);
}
