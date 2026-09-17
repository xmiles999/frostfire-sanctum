import { describe, expect, it } from "vitest";
import { PHYS_DT } from "../src/game/engine/constants";
import { LEVEL_01 } from "../src/game/levels/level01";
import { createSim } from "../src/game/sim/create";
import { stepSim } from "../src/game/sim/step";
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
