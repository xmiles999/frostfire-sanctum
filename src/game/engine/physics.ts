import type { Rect } from "./aabb";
import { rectsOverlap } from "./aabb";
import { COYOTE_MS, FALL_SPEED_MAX, GRAVITY, JUMP_BUFFER_MS, JUMP_SPEED } from "./constants";
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
  for (const s of solids) {
    if (!rectsOverlap(actorRect(a), s)) continue;
    hit = true;
    if (dx > 0) a.x = s.x - a.w;
    else if (dx < 0) a.x = s.x + s.w;
    if (dy > 0) a.y = s.y - a.h;
    else if (dy < 0) a.y = s.y + s.h;
  }
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
): void {
  if (a.downed) {
    a.vx = 0;
    a.vy = 0;
    return;
  }

  const dir = (wantRight ? 1 : 0) - (wantLeft ? 1 : 0);
  a.vx = dir * speed;
  if (dir !== 0) a.facing = dir as 1 | -1;

  if (wantJump) a.jumpBufferMs = JUMP_BUFFER_MS;
  else a.jumpBufferMs = Math.max(0, a.jumpBufferMs - dt * 1000);

  if (a.onGround) a.coyoteMs = COYOTE_MS;
  else a.coyoteMs = Math.max(0, a.coyoteMs - dt * 1000);

  a.vy += GRAVITY * dt;
  if (a.vy > FALL_SPEED_MAX) a.vy = FALL_SPEED_MAX;

  if (a.jumpBufferMs > 0 && a.coyoteMs > 0) {
    a.vy = -JUMP_SPEED;
    a.onGround = false;
    a.coyoteMs = 0;
    a.jumpBufferMs = 0;
  }

  resolveAxis(a, solids, a.vx * dt, 0);
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
}
