import { describe, expect, it } from "vitest";
import { TILE, PLATE_HOLD_MS, DOOR_LATCH_MS, DOOR_MOTION_MS } from "../src/game/engine/constants";
import { createSim } from "../src/game/sim/create";
import { blankLevel, idle, steps } from "./helpers";

describe("dual pressure latch", () => {
  it("one plate does not open the door", () => {
    const sim = createSim(blankLevel({ gatedSolids: [{ x: 16 * TILE, y: TILE, w: TILE, h: 6 * TILE }] }));
    sim.ember.x = sim.level.plates.ember.x;
    sim.ember.y = 7 * TILE - sim.ember.h;
    sim.ember.onGround = true;
    steps(sim, 200);
    expect(sim.doorOpen).toBe(false);
  });

  it("side contact does not count as standing on a plate", () => {
    const sim = createSim(blankLevel());
    sim.ember.x = sim.level.plates.ember.x - sim.ember.w + 3;
    sim.ember.y = 7 * TILE - sim.ember.h;
    sim.ember.onGround = true;

    steps(sim, 20);

    expect(sim.plateEmber).toBe(false);
  });

  it("both plates for 0.80s latch 5.00s", () => {
    const sim = createSim(blankLevel({ gatedSolids: [{ x: 16 * TILE, y: TILE, w: TILE, h: 6 * TILE }] }));
    sim.ember.x = sim.level.plates.ember.x;
    sim.ember.y = 7 * TILE - sim.ember.h;
    sim.ember.onGround = true;
    sim.frost.x = sim.level.plates.frost.x;
    sim.frost.y = 7 * TILE - sim.frost.h;
    sim.frost.onGround = true;
    const need = Math.ceil((PLATE_HOLD_MS / 1000) * 120) + 2;
    steps(sim, need, idle());
    expect(sim.doorOpen).toBe(true);
    expect(sim.doorPhase === "opening" || sim.doorPhase === "open").toBe(true);
    expect(sim.latchMs).toBeGreaterThan(DOOR_LATCH_MS - 50);
    sim.ember.x = 3 * TILE;
    sim.frost.x = 6 * TILE;
    const rest = Math.ceil(((DOOR_LATCH_MS + DOOR_MOTION_MS) / 1000) * 120) + 6;
    steps(sim, rest, idle());
    expect(sim.doorOpen).toBe(false);
    expect(sim.doorPhase).toBe("closed");
  });

  it("waits for the doorway to clear before closing", () => {
    const gate = { x: 16 * TILE, y: TILE, w: TILE, h: 6 * TILE };
    const sim = createSim(blankLevel({ gatedSolids: [gate] }));
    sim.ember.x = sim.level.plates.ember.x;
    sim.ember.y = 7 * TILE - sim.ember.h;
    sim.ember.onGround = true;
    sim.frost.x = sim.level.plates.frost.x;
    sim.frost.y = 7 * TILE - sim.frost.h;
    sim.frost.onGround = true;
    steps(sim, Math.ceil((PLATE_HOLD_MS / 1000) * 120) + 2);
    expect(sim.doorOpen).toBe(true);

    sim.ember.x = gate.x + 4;
    sim.ember.y = gate.y + gate.h - sim.ember.h;
    sim.frost.x = 4 * TILE;
    steps(sim, Math.ceil(((DOOR_LATCH_MS + DOOR_MOTION_MS) / 1000) * 120) + 8);
    expect(sim.doorOpen).toBe(true);
    expect(sim.doorPhase).toBe("open");

    sim.ember.x = 5 * TILE;
    steps(sim, Math.ceil((DOOR_MOTION_MS / 1000) * 120) + 4);
    expect(sim.doorOpen).toBe(false);
    expect(sim.doorPhase).toBe("closed");
  });
});
