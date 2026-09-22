import { describe, expect, it } from "vitest";
import { ACTOR_H, ACTOR_W, GRAVITY, JUMP_SPEED, TILE } from "../src/game/engine/constants";
import { rectsOverlap } from "../src/game/engine/aabb";
import { makeCamera, updateCamera } from "../src/game/engine/camera";
import { InputMap } from "../src/game/engine/input";
import { LEVELS } from "../src/game/levels/catalog";
import { branchLayout } from "../src/game/levels/layout";
import { createSim } from "../src/game/sim/create";
import { starsFor, stepSim } from "../src/game/sim/step";
import { gearWindowOpen, holdGateOpen, runesReady, solidsNow } from "../src/game/sim/world";
import { officialPolicy } from "../src/game/systems/replay";
import { blankLevel, idle, steps } from "./helpers";

describe.each(LEVELS)("room $id", level => {
  it("has safe supported spawns, a landscape room and six distinct collectibles", () => {
    const sim = createSim(level);
    expect(level.size.w / level.size.h).toBeGreaterThan(1.6);
    expect(new Set(level.collectibles?.map(g => g.id)).size).toBe(6);
    expect(level.collectibles?.filter(g => g.required)).toHaveLength(2);
    for (const who of ["ember", "frost"] as const) {
      const actor = sim[who];
      expect(level.solids.some(s => rectsOverlap(actor, s))).toBe(false);
      expect(level.solids.some(s => Math.abs(s.y - actor.y - ACTOR_H) < 1 && actor.x >= s.x && actor.x + ACTOR_W <= s.x + s.w)).toBe(true);
    }
  });

  it("clears with all six crystals, no deaths, no rescue and three stars using inputs only", () => {
    const sim = createSim(level);
    for (let i = 0; i < 120 * 120 && sim.status !== "cleared" && sim.status !== "failed"; i++) {
      stepSim(sim, officialPolicy(sim));
    }
    expect(sim.status).toBe("cleared");
    expect(sim.deaths).toBe(0);
    expect(sim.chargeUsed).toBe(false);
    expect(sim.collected).toHaveLength(6);
    expect(starsFor(sim)).toBe(3);
  });

  it("keeps the collection balcony below the closed cooperative gate's jump-over height", () => {
    const balcony = branchLayout(level.id).bonus;
    const maxRise = JUMP_SPEED ** 2 / (2 * GRAVITY);
    for (const gate of level.holdGates ?? []) {
      expect(gate.rects[0].y).toBeLessThan(balcony.y * TILE - maxRise);
    }
  });

  it.each([[1440, 698], [390, 532], [844, 256]])("fits the entire room in a %s × %s stage", (w, h) => {
    const camera = makeCamera(w, h);
    updateCamera(camera, createSim(level), 0);
    expect(camera.ox).toBeGreaterThanOrEqual(0);
    expect(camera.oy).toBeGreaterThanOrEqual(0);
    expect(camera.ox + level.size.w * TILE * camera.scale).toBeLessThanOrEqual(w + 0.001);
    expect(camera.oy + level.size.h * TILE * camera.scale).toBeLessThanOrEqual(h + 0.001);
  });
});

describe("collection and mechanism contracts", () => {
  it("uses five structurally distinct branches, not horizontal translations", () => {
    const profiles = LEVELS.map(level => {
      const layout = branchLayout(level.id);
      const origin = layout.steps[0].x;
      return JSON.stringify([...layout.steps, layout.bonus].map(s => ({
        x: Number((s.x - origin).toFixed(2)), y: s.y, w: s.w,
      })));
    });
    expect(new Set(profiles).size).toBe(5);
  });

  it("places the fifth frost rune on a supported elevated platform between clockwork gates", () => {
    const level = LEVELS[4];
    const rune = level.collectibles!.find(g => g.id === "frost-rune")!;
    const [entry, exit] = level.gear!.windows.slice(1).map(w => w.solidsWhenClosed[0]);
    expect(rune.required).toBe(true);
    expect(rune.rect.x).toBeGreaterThan(entry.x + entry.w);
    expect(rune.rect.x + rune.rect.w).toBeLessThan(exit.x);
    expect(rune.rect.y + rune.rect.h).toBeLessThan(12 * TILE);
    expect(level.solids.some(s => rune.rect.x >= s.x && rune.rect.x + rune.rect.w <= s.x + s.w && Math.abs(s.y - rune.rect.y - rune.rect.h - 6) < 1)).toBe(true);
    const sim = createSim(level);
    for (let i = 0; i < 120 * 40 && !sim.collected.includes(rune.id); i++) stepSim(sim, officialPolicy(sim));
    expect(sim.collected).toContain(rune.id);
    expect(sim.gearArmedMs).not.toBeNull();
    expect(sim.frost.x).toBeGreaterThan(entry.x + entry.w);
    expect(sim.frost.x).toBeLessThan(exit.x);
  });

  it("clears the fifth room after missing a cycle without taking the optional left branch", () => {
    const sim = createSim(LEVELS[4]);
    const input = new InputMap();
    const drive = (keys: string[], reached: () => boolean) => {
      input.clear();
      keys.forEach(key => input.down(key));
      for (let i = 0; i < 120 * 30 && !reached() && sim.status !== "failed"; i++) {
        stepSim(sim, input.pair());
      }
      expect(reached()).toBe(true);
    };
    const cx = (who: "ember" | "frost") => (sim[who].x + sim[who].w / 2) / TILE;
    drive(["KeyD"], () => cx("ember") >= 6.7);
    drive(["KeyJ"], () => sim.gearArmedMs !== null);
    drive(["KeyD"], () => cx("ember") >= 13.1);
    drive(["ArrowRight"], () => cx("frost") >= 7.4);
    drive([], () => sim.timeMs > 14000 && sim.gearArmedMs! >= 1450 && sim.gearArmedMs! < 1700);
    drive(["ArrowUp", "ArrowRight"], () => cx("frost") >= 11.05);
    drive([], () => sim.collected.includes("frost-rune"));
    drive([], () => sim.gearArmedMs! >= 3650 && sim.gearArmedMs! < 6000);
    drive(["ArrowUp", "ArrowRight"], () => cx("frost") >= 18.5);
    drive(["KeyD"], () => cx("ember") >= 18.5);
    drive([], () => sim.doorOpen);
    drive(["KeyD", "ArrowRight"], () => cx("ember") >= 21.4);
    drive(["ArrowRight"], () => cx("frost") >= 21.4);
    drive([], () => sim.status === "cleared");
    expect(sim.deaths).toBe(0);
    expect(sim.chargeUsed).toBe(false);
    expect(sim.collected).toHaveLength(5);
    expect(sim.collected).not.toContain("frost-branch");
    expect(starsFor(sim)).toBe(2);
  });

  it("prevents jumping from the fourth balcony over a closed phase gate", () => {
    const level = LEVELS[3];
    const gate = level.phaseGates!.find(g => g.side === "water")!;
    expect(gate.rects[0].y).toBeLessThan(branchLayout("04").bonus.y * TILE - JUMP_SPEED ** 2 / (2 * GRAVITY));
  });

  it("only the matching living actor collects a gem, once; restart resets it", () => {
    const level = blankLevel({
      collectibles: [{ id: "ice", who: "frost", required: true, rect: { x: 96, y: 7 * TILE - 30, w: 22, h: 24 } }],
    });
    const sim = createSim(level);
    steps(sim, 10);
    expect(sim.collected).toEqual([]);
    sim.frost.x = 96;
    steps(sim, 10);
    expect(sim.collected).toEqual(["ice"]);
    expect(runesReady(sim)).toBe(true);
    steps(sim, 20);
    expect(sim.collected).toEqual(["ice"]);
    expect(createSim(level).collected).toEqual([]);
  });

  it("both pressure plates cannot unlock the exit without both runes", () => {
    const sim = createSim(blankLevel({
      collectibles: [{ id: "missing", who: "ember", required: true, rect: { x: 48, y: 48, w: 20, h: 24 } }],
    }));
    sim.ember.x = sim.level.plates.ember.x + 20;
    sim.frost.x = sim.level.plates.frost.x + 20;
    steps(sim, 150);
    expect(sim.plateEmber && sim.plateFrost).toBe(true);
    expect(sim.doorOpen).toBe(false);
    sim.collected.push("missing");
    steps(sim, 2);
    expect(sim.doorOpen).toBe(true);
  });

  it("the burn room requires the oily bridge to collapse, not just two plates", () => {
    const sim = createSim(LEVELS[2]);
    sim.collected = sim.level.collectibles!.map(g => g.id);
    for (const who of ["ember", "frost"] as const) {
      sim[who].x = sim.level.plates[who].x + 30;
      sim[who].y = (who === "ember" ? 5.6 : 13.3) * TILE - ACTOR_H;
    }
    steps(sim, 150);
    expect(sim.doorOpen).toBe(false);
    const bridge = sim.bridges.find(b => b.id === "wood_mid")!;
    bridge.ignited = true;
    bridge.burnMs = 7995;
    steps(sim, 2);
    expect(bridge.collapsed).toBe(true);
    expect(sim.doorOpen).toBe(true);
  });

  it("a missed gear window returns next cycle instead of permanently locking the room", () => {
    const sim = createSim(LEVELS[4]);
    sim.gearArmedMs = 9998;
    stepSim(sim, idle());
    expect(sim.gearArmedMs).toBeGreaterThanOrEqual(0);
    expect(sim.gearArmedMs).toBeLessThan(10);
    expect(gearWindowOpen(sim, sim.level.gear!.windows[0])).toBe(true);
  });

  it("cooperative and clockwork gates wait for an occupant to leave", () => {
    const sim = createSim(LEVELS[4]);
    const gate = sim.level.holdGates![0];
    sim.frost.x = gate.rects[0].x + 2;
    expect(holdGateOpen(sim, gate)).toBe(true);
    expect(solidsNow(sim)).not.toContain(gate.rects[0]);
    sim.frost.x = 48;
    expect(holdGateOpen(sim, gate)).toBe(false);
    const clock = sim.level.gear!.windows[1];
    sim.gearArmedMs = 5000;
    sim.frost.x = clock.solidsWhenClosed[0].x + 2;
    expect(gearWindowOpen(sim, clock)).toBe(true);
    sim.frost.x = 48;
    expect(gearWindowOpen(sim, clock)).toBe(false);
  });

  it("one missing optional crystal prevents three stars but does not prevent a clear", () => {
    const sim = createSim(LEVELS[0]);
    sim.status = "cleared";
    sim.collected = sim.level.collectibles!.filter(g => g.id !== "frost-branch").map(g => g.id);
    expect(runesReady(sim)).toBe(true);
    expect(starsFor(sim)).toBe(2);
  });
});
