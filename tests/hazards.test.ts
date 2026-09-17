import { describe, expect, it } from "vitest";
import { createSim } from "../src/game/sim/create";
import { simWithHazard, steps } from "./helpers";

describe("element damage matrix", () => {
  it("ember dies in shallow water, frost lives", () => {
    const e = simWithHazard("water_shallow", "ember");
    steps(e, 3);
    expect(e.ember.downed).toBe(true);

    const f = simWithHazard("water_shallow", "frost");
    steps(f, 3);
    expect(f.frost.downed).toBe(false);
  });

  it("frost dies in shallow lava, ember lives", () => {
    const f = simWithHazard("lava_shallow", "frost");
    steps(f, 3);
    expect(f.frost.downed).toBe(true);

    const e = simWithHazard("lava_shallow", "ember");
    steps(e, 3);
    expect(e.ember.downed).toBe(false);
  });

  it("ice mist downs ember only", () => {
    const e = simWithHazard("ice_mist", "ember");
    steps(e, 3);
    expect(e.ember.downed).toBe(true);
    const f = simWithHazard("ice_mist", "frost");
    steps(f, 3);
    expect(f.frost.downed).toBe(false);
  });
});

describe("steam cycle", () => {
  it("telegraph is not lethal; lethal downs frost only", async () => {
    const { STEAM_SAFE_MS, STEAM_TELEGRAPH_MS } = await import("../src/game/engine/constants");
    const { blankLevel } = await import("./helpers");
    const { tileRect } = await import("../src/game/engine/aabb");
    const { TILE } = await import("../src/game/engine/constants");
    const level = blankLevel({
      hazards: [{ id: "steam", type: "steam_hot", rect: tileRect(2, 6, 8, 2, TILE) }],
    });
    const sim = createSim(level);
    sim.frost.x = 3 * TILE;
    sim.frost.y = 6.2 * TILE;
    sim.timeMs = STEAM_SAFE_MS + 10;
    steps(sim, 2);
    expect(sim.steamPhase).toBe("telegraph");
    expect(sim.frost.downed).toBe(false);

    const sim2 = createSim(level);
    sim2.frost.x = 3 * TILE;
    sim2.frost.y = 6.2 * TILE;
    sim2.ember.x = 3 * TILE;
    sim2.ember.y = 6.2 * TILE;
    sim2.timeMs = STEAM_SAFE_MS + STEAM_TELEGRAPH_MS + 10;
    steps(sim2, 2);
    expect(sim2.steamPhase).toBe("lethal");
    expect(sim2.frost.downed).toBe(true);
    expect(sim2.ember.downed).toBe(false);
  });
});
