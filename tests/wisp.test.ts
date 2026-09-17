import { describe, expect, it } from "vitest";
import { TILE, WISP_RANGE } from "../src/game/engine/constants";
import { createSim } from "../src/game/sim/create";
import { blankLevel, idle, steps } from "./helpers";

describe("heat-seeking wisp", () => {
  it("chases nearest actor, contact downs frost, ember is safe", () => {
    const level = blankLevel({
      wispNest: { x: 8 * TILE, y: 5 * TILE },
    });
    const sim = createSim(level);
    sim.wisp.x = 8 * TILE;
    sim.wisp.y = 5 * TILE;
    sim.ember.x = 8 * TILE + WISP_RANGE * 0.3;
    sim.ember.y = 5 * TILE;
    sim.frost.x = 8 * TILE + WISP_RANGE * 0.8;
    sim.frost.y = 5 * TILE;
    steps(sim, 40);
    expect(sim.wisp.phase === "acquire" || sim.wisp.phase === "chase").toBe(true);
    expect(sim.wisp.target).toBe("ember");

    const hit = createSim(level);
    hit.wisp.x = 10 * TILE;
    hit.wisp.y = 6 * TILE;
    hit.frost.x = 10 * TILE - 8;
    hit.frost.y = 6 * TILE - 8;
    hit.ember.x = 2 * TILE;
    steps(hit, 5, idle());
    expect(hit.frost.downed).toBe(true);
    expect(hit.ember.downed).toBe(false);
  });

  it("returns to nest after losing targets", () => {
    const sim = createSim(blankLevel({ wispNest: { x: 4 * TILE, y: 4 * TILE } }));
    sim.wisp.phase = "lost";
    sim.wisp.lostMs = 200;
    sim.wisp.x = 12 * TILE;
    sim.wisp.y = 4 * TILE;
    sim.ember.x = 20 * TILE;
    sim.frost.x = 20 * TILE;
    steps(sim, 400);
    expect(sim.wisp.phase).toBe("idle");
    expect(Math.abs(sim.wisp.x - 4 * TILE)).toBeLessThan(3.5 * TILE);
  });
});
