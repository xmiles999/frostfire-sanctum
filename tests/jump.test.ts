import { describe, expect, it } from "vitest";
import { TILE } from "../src/game/engine/constants";
import { createSim } from "../src/game/sim/create";
import { blankLevel, idle, steps } from "./helpers";

describe("jump interaction", () => {
  it("holding jump does not auto-hop again after landing", () => {
    const sim = createSim(blankLevel());
    sim.ember.x = 4 * TILE;
    sim.ember.y = 7 * TILE - sim.ember.h;
    sim.ember.onGround = true;
    const intents = idle();
    intents.ember.jump = true;
    intents.ember.up = true;

    steps(sim, 240, intents);

    expect(sim.ember.onGround).toBe(true);
    expect(sim.ember.vy).toBe(0);
  });

  it("releasing jump early produces a shorter arc", () => {
    const full = createSim(blankLevel());
    const short = createSim(blankLevel());
    for (const sim of [full, short]) {
      sim.ember.x = 4 * TILE;
      sim.ember.y = 7 * TILE - sim.ember.h;
      sim.ember.onGround = true;
    }

    const held = idle();
    held.ember.jump = true;
    held.ember.up = true;
    steps(full, 1, held);
    steps(short, 1, held);

    const released = idle();
    steps(short, 20, released);
    steps(full, 20, held);

    expect(short.ember.y).toBeGreaterThan(full.ember.y);
    expect(short.ember.vy).toBeGreaterThan(full.ember.vy);
  });

  it("buffers a jump pressed shortly before landing", () => {
    const sim = createSim(blankLevel());
    sim.ember.x = 4 * TILE;
    sim.ember.y = 7 * TILE - sim.ember.h - 20;
    sim.ember.vy = 300;
    sim.ember.onGround = false;

    const pressed = idle();
    pressed.ember.jump = true;
    pressed.ember.up = true;
    steps(sim, 1, pressed);
    steps(sim, 20, idle());

    expect(sim.ember.vy).toBeLessThan(0);
    expect(sim.ember.onGround).toBe(false);
  });
});
