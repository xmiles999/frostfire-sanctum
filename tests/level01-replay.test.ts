import { describe, expect, it } from "vitest";
import { PHYS_DT } from "../src/game/engine/constants";
import { LEVEL_01 } from "../src/game/levels/level01";
import { createSim } from "../src/game/sim/create";
import { stepSim } from "../src/game/sim/step";
import { EMPTY_INTENT } from "../src/game/sim/types";
import { frostRushesWispPolicy, officialPolicy } from "../src/game/systems/replay";

describe("level 01", () => {
  it("single occupant of one exit does not clear", () => {
    const sim = createSim(LEVEL_01);
    sim.ember.x = sim.level.exits.ember.x + 4;
    sim.ember.y = sim.level.exits.ember.y + 4;
    for (let i = 0; i < 120; i++) stepSim(sim, officialPolicy(sim));
    // frost still at spawn — should not clear
    expect(sim.status).not.toBe("cleared");
  });

  it("frost rushing the wisp corridor is downed", () => {
    const sim = createSim(LEVEL_01);
    const limit = Math.ceil(12 / PHYS_DT);
    for (let i = 0; i < limit; i++) {
      stepSim(sim, frostRushesWispPolicy(sim));
      if (sim.frost.downed) break;
    }
    expect(sim.frost.downed).toBe(true);
    expect(sim.downedCause).toBe("wisp");
  });

  it("ember walking the first gap without jumping is downed", () => {
    const sim = createSim(LEVEL_01);
    const limit = Math.ceil(10 / PHYS_DT);
    const ember = { ...EMPTY_INTENT, right: true };
    const frost = { ...EMPTY_INTENT };
    for (let i = 0; i < limit; i++) {
      stepSim(sim, { ember, frost });
      if (sim.ember.downed) break;
    }
    expect(sim.ember.downed).toBe(true);
    expect(["gap_mist", "water_spawn", "water_mid", "void"]).toContain(sim.downedCause);
  });

  it("frost walking the lava seep without jumping is downed", () => {
    const sim = createSim(LEVEL_01);
    sim.frost.x = 14.2 * 48;
    sim.frost.y = sim.level.spawns.frost.y;
    sim.frost.onGround = true;
    sim.ember.x = 2 * 48;
    sim.wisp.x = 50 * 48;
    sim.wisp.nestX = 50 * 48;
    const limit = Math.ceil(4 / PHYS_DT);
    const ember = { ...EMPTY_INTENT };
    const frost = { ...EMPTY_INTENT, right: true };
    for (let i = 0; i < limit; i++) {
      stepSim(sim, { ember, frost });
      if (sim.frost.downed) break;
    }
    expect(sim.frost.downed).toBe(true);
    expect(sim.downedCause).toBe("lava_jump");
  });

  it("official policy clears without deaths or charge", () => {
    const sim = createSim(LEVEL_01);
    const limit = Math.ceil(120 / PHYS_DT);
    for (let i = 0; i < limit; i++) {
      stepSim(sim, officialPolicy(sim));
      if (sim.status === "cleared" || sim.status === "failed") break;
    }
    expect(sim.status).toBe("cleared");
    expect(sim.deaths).toBe(0);
    expect(sim.chargeLeft).toBe(1);
    expect(sim.ember.downed).toBe(false);
    expect(sim.frost.downed).toBe(false);
  });
});
