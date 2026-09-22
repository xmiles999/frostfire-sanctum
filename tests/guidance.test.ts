import { describe, expect, it } from "vitest";
import { TILE } from "../src/game/engine/constants";
import { LEVELS } from "../src/game/levels/catalog";
import { createSim } from "../src/game/sim/create";
import { roomGuidance } from "../src/game/sim/guidance";

describe("state-driven player guidance", () => {
  it("does not ask for the inaccessible chamber rune before starting the gear", () => {
    const sim = createSim(LEVELS[4]);
    expect(roomGuidance(sim).objective).toContain("阁楼符文");
    sim.collected.push("ember-rune");
    expect(roomGuidance(sim).objective).toContain("启动齿轮");
    sim.gearArmedMs = 1500;
    expect(roomGuidance(sim).objective).toContain("穿入中室");
    sim.frost.x = 10 * TILE;
    expect(roomGuidance(sim).objective).toContain("中室石台");
  });

  it("reports remaining gate windows, next-cycle waits and occupied-gate closure delay", () => {
    const sim = createSim(LEVELS[4]);
    sim.ember.x = 11 * TILE;
    sim.gearArmedMs = 1500;
    expect(roomGuidance(sim).mechanism).toBe("首闸 · 可通过 1.3s");
    sim.gearArmedMs = 3500;
    expect(roomGuidance(sim).mechanism).toBe("首闸 · 7.9s 后开启");
    sim.frost.x = 8.6 * TILE;
    expect(roomGuidance(sim).mechanism).toContain("延迟关闭");
    sim.frost.x = 10 * TILE;
    expect(roomGuidance(sim).mechanism).toBe("末闸 · 0.1s 后开启");
  });

  it("uses simulation time for steam and burn countdowns without mutating state", () => {
    const steam = createSim(LEVELS[0]);
    steam.timeMs = 1000;
    expect(roomGuidance(steam).mechanism).toBe("蒸汽安全窗 · 0.4s");
    steam.timeMs = 1500;
    expect(roomGuidance(steam).mechanism).toBe("蒸汽即将喷发 · 0.3s");
    const burn = createSim(LEVELS[2]);
    const bridge = burn.bridges.find(b => b.id === "wood_mid")!;
    bridge.ignited = true;
    bridge.burnMs = 3000;
    const before = JSON.stringify(burn);
    expect(roomGuidance(burn).mechanism).toBe("油桥烧塌 · 5.0s");
    expect(JSON.stringify(burn)).toBe(before);
  });

  it("directs players to lower a deep tide before heading to exits", () => {
    const sim = createSim(LEVELS[1]);
    sim.doorOpen = true;
    sim.tideLevel = 2;
    expect(roomGuidance(sim).objective).toContain("降到中水");
    sim.tideLevel = 1;
    expect(roomGuidance(sim).objective).toBe("两人分别进入同色出口");
  });

  it("prioritizes rescue over normal collection and mechanism tasks", () => {
    const sim = createSim(LEVELS[4]);
    sim.status = "rescue_window";
    expect(roomGuidance(sim).objective).toContain("救援");
    sim.status = "cleared";
    expect(roomGuidance(sim).objective).toContain("本关完成");
  });
});
