import { COYOTE_MS } from "../engine/constants";
import { gateOccupied, standingOnPlate } from "./world";
import type { SimState } from "./types";

export function stepFragilePlatforms(sim: SimState, dtMs: number): void {
  for (const spec of sim.level.fragilePlatforms ?? []) {
    const state = sim.fragilePlatforms.find(p => p.id === spec.id)!;
    const riders = [sim.ember, sim.frost].filter(a => standingOnPlate(a, spec.rect));
    if (state.phase === "stable") {
      if (riders.length) {
        state.phase = "cracking";
        state.remainingMs = spec.crumbleMs;
      }
      continue;
    }
    state.remainingMs = Math.max(0, state.remainingMs - dtMs);
    if (state.remainingMs > 0) continue;
    if (state.phase === "cracking") {
      state.phase = "gone";
      state.remainingMs = spec.respawnMs;
      for (const rider of riders) {
        rider.onGround = false;
        rider.coyoteMs = COYOTE_MS;
      }
    } else if (!gateOccupied(sim, [spec.rect])) {
      state.phase = "stable";
    }
  }
}
