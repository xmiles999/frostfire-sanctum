import { describe, expect, it } from "vitest";
import { ACTOR_H, TILE } from "../src/game/engine/constants";
import { LEVELS } from "../src/game/levels/catalog";
import { createSim } from "../src/game/sim/create";
import { interactionLabel } from "../src/game/sim/interactions";
import { roomGuidance } from "../src/game/sim/guidance";
import { STEAM_STYLE, steamParticles } from "../src/game/view/hazardVisuals";
import { blankLevel, simWithHazard, steps } from "./helpers";

describe("unambiguous steam and cold zones", () => {
  it.each(["safe", "telegraph", "lethal"] as const)("keeps %s steam particles inside the real danger rectangle", phase => {
    const vents = LEVELS.flatMap(level => level.hazards.filter(h => h.type === "steam_hot"));
    for (const vent of vents) {
      for (let time = 0; time < 10000; time += 173) {
        const particles = steamParticles(vent.rect, phase, time);
        expect(particles).toHaveLength(STEAM_STYLE[phase].particles);
        for (const p of particles) {
          expect(p.x - p.radius).toBeGreaterThanOrEqual(vent.rect.x);
          expect(p.x + p.radius).toBeLessThanOrEqual(vent.rect.x + vent.rect.w + 0.001);
          expect(p.y - p.radius).toBeGreaterThanOrEqual(vent.rect.y);
          expect(p.y + p.radius).toBeLessThanOrEqual(vent.rect.y + vent.rect.h + 0.001);
          expect(p.alpha).toBeLessThanOrEqual(0.22);
          if (phase === "safe") expect(p.y - p.radius).toBeGreaterThanOrEqual(vent.rect.y + vent.rect.h - 20);
        }
      }
    }
  });

  it("distinguishes safe, warning and lethal phases with explicit words, not only color", () => {
    expect(STEAM_STYLE.safe.label).toBe("冷却 · 朔可过");
    expect(STEAM_STYLE.telegraph.label).toBe("蓄压 · 朔退后");
    expect(STEAM_STYLE.lethal.label).toBe("喷发 · 朔禁入");
  });

  it("explains nearby cold zones differently for the two characters", () => {
    const sim = createSim(blankLevel({
      hazards: [{ id: "cold", type: "ice_mist", rect: { x: 140, y: 7 * TILE - ACTOR_H, w: 50, h: ACTOR_H } }],
    }));
    sim.ember.x = 110;
    sim.frost.x = 110;
    expect(interactionLabel(sim, "ember")).toContain("烬禁入");
    expect(interactionLabel(sim, "frost")).toContain("朔可安全通过");
  });

  it("explains nearby vents using the actual simulation phase and matching character", () => {
    const sim = createSim(blankLevel({
      hazards: [{ id: "steam", type: "steam_hot", rect: { x: 140, y: 7 * TILE - ACTOR_H, w: 50, h: ACTOR_H } }],
    }));
    sim.ember.x = 110;
    sim.frost.x = 110;
    expect(interactionLabel(sim, "ember")).toContain("对烬安全");
    expect(interactionLabel(sim, "frost")).toContain("冷却");
    sim.timeMs = 1500;
    expect(interactionLabel(sim, "frost")).toContain("蓄压");
    sim.timeMs = 2200;
    expect(interactionLabel(sim, "frost")).toContain("喷发");
  });

  it("does not change the damage rules when changing hazard art", () => {
    const coldEmber = simWithHazard("ice_mist", "ember");
    const coldFrost = simWithHazard("ice_mist", "frost");
    const hotEmber = simWithHazard("steam_hot", "ember");
    const hotFrost = simWithHazard("steam_hot", "frost");
    hotEmber.timeMs = hotFrost.timeMs = 2200;
    for (const sim of [coldEmber, coldFrost, hotEmber, hotFrost]) steps(sim, 2);
    expect(coldEmber.ember.downed).toBe(true);
    expect(coldFrost.frost.downed).toBe(false);
    expect(hotEmber.ember.downed).toBe(false);
    expect(hotFrost.frost.downed).toBe(true);
  });

  it("does not display a phantom steam countdown in rooms with no steam vent", () => {
    const sim = createSim(LEVELS[2]);
    sim.bridges.find(b => b.id === "wood_mid")!.collapsed = true;
    expect(sim.level.hazards.some(h => h.type === "steam_hot")).toBe(false);
    expect(roomGuidance(sim).mechanism).toBe("协作出口 · 等待双压板");
  });
});
