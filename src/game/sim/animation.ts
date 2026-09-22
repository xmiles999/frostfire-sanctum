import { HURT_MS } from "../engine/constants";
import type { ActorAnim, ActorState } from "./types";

/** Animation owns a state-local clock; a new action always starts on its first frame. */
export function updateActorAnimation(actor: ActorState, dt: number): void {
  let next: ActorAnim;
  if (actor.downed) next = actor.anim === "hurt" && actor.animTime * 1000 < HURT_MS ? "hurt" : "downed";
  else if (!actor.onGround) next = actor.vy < 0 ? "jump" : "fall";
  else if (actor.landMs > 80) next = "land";
  else if (actor.pushing) next = "push";
  else if (Math.abs(actor.vx) > 8 && actor.moveDir * actor.vx <= 0) next = "brake";
  else if (Math.abs(actor.vx) > 8) next = "walk";
  else if (actor.interactMs > 0) next = "interact";
  else next = "idle";
  if (next !== actor.anim) {
    actor.anim = next;
    actor.animTime = 0;
  } else {
    actor.animTime += dt * (next === "walk" || next === "push" ? Math.abs(actor.vx) / 350 : 1);
  }
}
