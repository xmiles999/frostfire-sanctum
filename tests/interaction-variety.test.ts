import { describe, expect, it } from "vitest";
import { ACTOR_H, TILE } from "../src/game/engine/constants";
import { LEVELS } from "../src/game/levels/catalog";
import { createSim } from "../src/game/sim/create";
import { stepSim } from "../src/game/sim/step";
import { interactionLabel } from "../src/game/sim/interactions";
import { solidsNow } from "../src/game/sim/world";
import { blankLevel, idle, steps } from "./helpers";

describe("recoverable fragile footholds", () => {
  const rect = { x: 3 * TILE, y: 5 * TILE, w: 2 * TILE, h: 14 };
  const level = () => blankLevel({
    fragilePlatforms: [{ id: "trial", rect, crumbleMs: 650, respawnMs: 2200 }],
  });
  const standing = () => {
    const sim = createSim(level());
    sim.frost.x = rect.x + 20;
    sim.frost.y = rect.y - ACTOR_H;
    sim.frost.onGround = true;
    return sim;
  };

  it("warns before collapsing, keeps counting after departure, then restores its collision", () => {
    const sim = standing();
    steps(sim, 1);
    expect(sim.fragilePlatforms[0].phase).toBe("cracking");
    expect(solidsNow(sim)).toContain(rect);
    expect(interactionLabel(sim, "frost")).toContain("后坍塌");
    sim.frost.x = 6 * TILE;
    steps(sim, 80);
    expect(sim.fragilePlatforms[0].phase).toBe("gone");
    expect(solidsNow(sim)).not.toContain(rect);
    steps(sim, 266);
    expect(sim.fragilePlatforms[0].phase).toBe("stable");
    expect(solidsNow(sim)).toContain(rect);
  });

  it("does not restore a platform through a character or crate", () => {
    const sim = standing();
    const state = sim.fragilePlatforms[0];
    state.phase = "gone";
    state.remainingMs = 0;
    sim.frost.y = rect.y - 10;
    steps(sim, 1);
    expect(state.phase).toBe("gone");
    sim.frost.x = 6 * TILE;
    sim.crates.push({ id: "block", x: rect.x + 10, y: rect.y - 10, w: 30, h: 30, vx: 0, vy: 0, density: 1, onGround: false });
    steps(sim, 1);
    expect(state.phase).toBe("gone");
    sim.crates[0].x = 8 * TILE;
    steps(sim, 1);
    expect(state.phase).toBe("stable");
  });

  it("freezes collapse timers on pause and resets the platform on restart", () => {
    const sim = standing();
    steps(sim, 10);
    const remaining = sim.fragilePlatforms[0].remainingMs;
    sim.status = "paused";
    steps(sim, 240);
    expect(sim.fragilePlatforms[0].remainingMs).toBe(remaining);
    expect(createSim(level()).fragilePlatforms[0]).toEqual({ id: "trial", phase: "stable", remainingMs: 0 });
  });

  it("introduces fragile bonus routes only after the first two learning rooms", () => {
    expect(LEVELS[0].fragilePlatforms).toBeUndefined();
    expect(LEVELS[1].fragilePlatforms).toBeUndefined();
    expect(LEVELS[2].fragilePlatforms![0].crumbleMs).toBe(900);
    expect(LEVELS[3].fragilePlatforms![0].crumbleMs).toBe(650);
    for (const level of LEVELS.slice(2, 4)) {
      expect(level.solids).not.toContain(level.fragilePlatforms![0].rect);
    }
  });
});

describe("intentional mechanism interaction", () => {
  it("holding a phase plate does not flip gates back after the cooldown expires", () => {
    const sim = createSim(blankLevel({
      puzzle: "phase", extraPlates: [{ id: "phase", who: "ember", rect: { x: 80, y: 7 * TILE - 10, w: 80, h: 10 } }],
    }));
    steps(sim, 120);
    expect(sim.phase).toBe(0);
    steps(sim, 600);
    expect(sim.phase).toBe(0);
    sim.ember.x = 5 * TILE;
    steps(sim, 1);
    sim.ember.x = 96;
    steps(sim, 120);
    expect(sim.phase).toBe(1);
  });

  it("a downed actor cannot operate a nearby lever", () => {
    const sim = createSim(blankLevel({
      levers: [{ id: "tide", kind: "tide", rect: { x: 96, y: 7 * TILE - 30, w: 24, h: 30 } }],
    }));
    sim.ember.downed = true;
    const input = idle();
    input.ember.interact = true;
    stepSim(sim, input);
    expect(sim.tideLevel).toBe(0);
    expect(interactionLabel(sim, "ember")).toContain("已倒地");
  });

  it("shows the actual next tide setting, confirms interaction, and does not repeat while held", () => {
    const sim = createSim(blankLevel({
      levers: [{ id: "tide", kind: "tide", rect: { x: 96, y: 7 * TILE - 30, w: 24, h: 30 } }],
    }));
    expect(interactionLabel(sim, "ember")).toBe("J 拨至深水位");
    steps(sim, 1);
    expect(sim.tideLevel).toBe(2);
    expect(sim.feedback?.text).toBe("潮位已切换 · 深水");
    expect(interactionLabel(sim, "ember")).toBe("J 拨至中水位");
    const input = idle();
    input.ember.interact = true;
    steps(sim, 15, input);
    expect(sim.tideLevel).toBe(1);
    expect(sim.ember.interactMs).toBeGreaterThan(0);
    expect(sim.ember.anim).toBe("interact");
    steps(sim, 120, input);
    expect(sim.tideLevel).toBe(1);
  });

  it("keeps feedback frozen when paused and clears it after its display duration", () => {
    const sim = createSim(blankLevel({
      collectibles: [{ id: "one", who: "ember", rect: { x: 96, y: 7 * TILE - 30, w: 20, h: 24 } }],
    }));
    steps(sim, 1);
    expect(sim.feedback?.text).toContain("取得晶石");
    sim.status = "paused";
    steps(sim, 360);
    expect(sim.feedback?.remainingMs).toBe(1800);
    sim.status = "playing";
    steps(sim, 240);
    expect(sim.feedback).toBeNull();
  });

  it("makes later three-star targets stricter without introducing a hard failure timer", () => {
    expect(LEVELS.map(l => l.score.starTimeMs)).toEqual([120000, 110000, 100000, 90000, 80000]);
    const sim = createSim(LEVELS[4]);
    sim.timeMs = 81000;
    steps(sim, 1);
    expect(sim.status).toBe("playing");
    const windows = sim.level.gear!.windows;
    expect(windows[1].closeAtMs - windows[1].openAtMs).toBe(1400);
    expect(windows[2].closeAtMs - windows[2].openAtMs).toBe(2800);
  });
});
