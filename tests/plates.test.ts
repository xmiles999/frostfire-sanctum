import { describe, expect, it } from "vitest";
import { TILE, PLATE_HOLD_MS, DOOR_LATCH_MS } from "../src/game/engine/constants";
import { createSim } from "../src/game/sim/create";
import { blankLevel, idle, steps } from "./helpers";

describe("dual pressure latch", () => {
  it("one plate does not open the door", () => {
    const sim = createSim(blankLevel({ gatedSolids: [{ x: 16 * TILE, y: TILE, w: TILE, h: 6 * TILE }] }));
    sim.ember.x = sim.level.plates.ember.x;
    sim.ember.y = sim.level.plates.ember.y - sim.ember.h + 4;
    steps(sim, 200);
    expect(sim.doorOpen).toBe(false);
  });

  it("both plates for 0.80s latch 5.00s", () => {
    const sim = createSim(blankLevel({ gatedSolids: [{ x: 16 * TILE, y: TILE, w: TILE, h: 6 * TILE }] }));
    sim.ember.x = sim.level.plates.ember.x;
    sim.ember.y = sim.level.plates.ember.y - sim.ember.h + 4;
    sim.frost.x = sim.level.plates.frost.x;
    sim.frost.y = sim.level.plates.frost.y - sim.frost.h + 4;
    const need = Math.ceil((PLATE_HOLD_MS / 1000) * 120) + 2;
    steps(sim, need, idle());
    expect(sim.doorOpen).toBe(true);
    expect(sim.latchMs).toBeGreaterThan(DOOR_LATCH_MS - 50);
    sim.ember.x = 3 * TILE;
    sim.frost.x = 6 * TILE;
    const rest = Math.ceil((DOOR_LATCH_MS / 1000) * 120) + 4;
    steps(sim, rest, idle());
    expect(sim.doorOpen).toBe(false);
  });
});
