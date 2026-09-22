import { describe, expect, it } from "vitest";
import { PHYS_DT, TILE } from "../src/game/engine/constants";
import { LEVEL_02 } from "../src/game/levels/level02";
import { LEVEL_03 } from "../src/game/levels/level03";
import { LEVEL_04 } from "../src/game/levels/level04";
import { LEVEL_05 } from "../src/game/levels/level05";
import { createSim } from "../src/game/sim/create";
import { stepSim } from "../src/game/sim/step";
import { EMPTY_INTENT } from "../src/game/sim/types";
import { officialPolicy } from "../src/game/systems/replay";

function runOfficial(level: typeof LEVEL_02, seconds = 150) {
  const sim = createSim(level);
  const limit = Math.ceil(seconds / PHYS_DT);
  for (let i = 0; i < limit; i++) {
    stepSim(sim, officialPolicy(sim));
    if (sim.status === "cleared" || sim.status === "failed") break;
  }
  return sim;
}

describe("later levels official clears", () => {
  it("level 02 tide crate clears without deaths", () => {
    const sim = runOfficial(LEVEL_02);
    expect(sim.status).toBe("cleared");
    expect(sim.deaths).toBe(0);
  });

  it("level 03 burn bridge clears without deaths", () => {
    const sim = runOfficial(LEVEL_03, 120);
    expect(sim.status).toBe("cleared");
    expect(sim.deaths).toBe(0);
  });

  it("level 04 phase gates clear without deaths", () => {
    const sim = runOfficial(LEVEL_04);
    expect(sim.status).toBe("cleared");
    expect(sim.deaths).toBe(0);
  });

  it("level 05 gear delay clears without deaths", () => {
    const sim = runOfficial(LEVEL_05);
    expect(sim.status).toBe("cleared");
    expect(sim.deaths).toBe(0);
  });
});

describe("later levels punishments", () => {
  it("walking into the tide lever changes tide without interact", () => {
    const sim = createSim(LEVEL_02);
    sim.ember.x = 5.4 * TILE;
    sim.ember.y = sim.level.spawns.ember.y;
    sim.ember.onGround = true;
    const ember = { ...EMPTY_INTENT, right: true };
    const frost = { ...EMPTY_INTENT };
    const limit = Math.ceil(3 / PHYS_DT);
    for (let i = 0; i < limit; i++) {
      stepSim(sim, { ember, frost });
      if (sim.tideLevel === 2) break;
    }
    expect(sim.tideLevel).toBe(2);
  });

  it("ember standing on the low path at deep tide is downed", () => {
    const sim = createSim(LEVEL_02);
    sim.tideLevel = 2;
    sim.ember.x = 4 * TILE;
    sim.ember.y = 5.6 * TILE - sim.ember.h;
    sim.ember.onGround = true;
    for (let i = 0; i < 8; i++) stepSim(sim, { ember: { ...EMPTY_INTENT }, frost: { ...EMPTY_INTENT } });
    expect(sim.ember.downed).toBe(true);
    expect(sim.downedCause).toBe("ember_flood");
  });

  it("frost entering the inner ring before ember lures the wisp is downed", () => {
    const sim = createSim(LEVEL_04);
    const frost = { ...EMPTY_INTENT, right: true };
    const ember = { ...EMPTY_INTENT };
    const limit = Math.ceil(12 / PHYS_DT);
    for (let i = 0; i < limit; i++) {
      stepSim(sim, { ember, frost });
      if (sim.frost.downed) break;
    }
    expect(sim.frost.downed).toBe(true);
    expect(["wisp", "water_gate_bed", "lava_frost_inner"]).toContain(sim.downedCause);
  });
});
