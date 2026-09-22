import { JUMP_SPEED, LAND_RECOVERY_MS } from "../engine/constants";
import type { ActorState } from "../sim/types";

/** Art stays in existing atlases; physics selects takeoff/apex/fall poses instead of looping jumps. */
export function actorPose(actor: ActorState, reducedMotion = false) {
  const dying = actor.anim === "hurt" || actor.anim === "downed";
  const air = actor.anim === "jump" || actor.anim === "fall";
  const atlas = dying ? actor.anim : air ? "jump" : actor.anim === "walk" || actor.anim === "push" ? "walk" : "idle";
  const frame = air
    ? actor.anim === "jump"
      ? Math.min(2, Math.floor((1 + actor.vy / JUMP_SPEED) * 3))
      : Math.min(5, 3 + Math.floor(actor.vy / 350))
    : actor.anim === "interact" || actor.anim === "brake" || actor.anim === "land" ? 0
      : Math.floor(actor.animTime * (dying ? 12 : actor.anim === "push" ? 9 : actor.anim === "walk" ? 14 : 8));
  const land = reducedMotion ? 0 : actor.landMs / LAND_RECOVERY_MS * actor.landImpact * 0.18;
  const stretch = !reducedMotion && air && actor.vy < -180 ? 0.055 : 0;
  const push = !reducedMotion && actor.pushing ? 0.045 : 0;
  const deathSquash = dying ? Math.min(0.16, actor.animTime * 0.35) : 0;
  const interaction = !reducedMotion && actor.interactMs > 0 ? Math.sin(actor.interactMs / 400 * Math.PI) * 0.08 : 0;
  return {
    atlas,
    frame: Math.max(0, frame),
    loop: !air && !dying,
    scaleX: 1 + land + push + deathSquash - stretch,
    scaleY: 1 - land - push - deathSquash + stretch,
    rotation: reducedMotion || dying ? 0 : actor.anim === "brake" ? -Math.sign(actor.vx) * 0.09
      : actor.pushing ? actor.facing * 0.1
        : air ? Math.max(-0.08, Math.min(0.08, actor.vx / 4200))
          : actor.facing * interaction,
  };
}
