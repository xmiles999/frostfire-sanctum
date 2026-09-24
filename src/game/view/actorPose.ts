import { JUMP_SPEED, LAND_RECOVERY_MS } from "../engine/constants";
import type { ActorState } from "../sim/types";

/** Tail frames 4/5 are deeply crouched poses, not a fast-fall animation. */
export function actorPose(actor: ActorState, reducedMotion = false) {
  const dying = actor.anim === "hurt" || actor.anim === "downed";
  const air = actor.anim === "jump" || actor.anim === "fall";
  const atlas = dying ? actor.anim : air ? "jump" : actor.anim === "walk" || actor.anim === "push" ? "walk" : "idle";
  const frame = air
    ? actor.vy < -JUMP_SPEED * 0.7 ? 0
      : actor.vy < -JUMP_SPEED * 0.25 ? 1
        : actor.vy <= JUMP_SPEED * 0.25 ? 2 : 3
    : actor.anim === "interact" || actor.anim === "brake" || actor.anim === "land" ? 0
      : Math.floor(actor.animTime * (dying ? 12 : actor.anim === "push" ? 9 : actor.anim === "walk" ? 12 : 6));
  const recovery = Math.max(0, Math.min(1, actor.landMs / LAND_RECOVERY_MS));
  const land = reducedMotion || air || dying ? 0 : recovery * recovery * (3 - 2 * recovery) * actor.landImpact * 0.08;
  const stretch = !reducedMotion && air ? Math.max(0, Math.min(1, -actor.vy / JUMP_SPEED)) * 0.04 : 0;
  const push = !reducedMotion && !air && actor.pushing ? 0.045 : 0;
  const deathSquash = dying ? Math.min(0.16, actor.animTime * 0.35) : 0;
  const interaction = !reducedMotion && actor.interactMs > 0 ? Math.sin(actor.interactMs / 400 * Math.PI) * 0.08 : 0;
  return {
    atlas,
    frame: Math.max(0, frame),
    loop: !air && !dying,
    scaleX: 1 + land + push + deathSquash - stretch,
    scaleY: 1 - land - push - deathSquash + stretch,
    rotation: reducedMotion || dying ? 0 : actor.anim === "brake" ? -Math.sign(actor.vx) * 0.09
      : air ? Math.max(-0.055, Math.min(0.055, actor.vx / 6000))
        : actor.pushing ? actor.facing * 0.1
          : actor.facing * interaction,
  };
}
