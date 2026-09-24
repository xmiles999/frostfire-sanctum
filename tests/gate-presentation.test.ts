import { describe, expect, it } from "vitest";
import { LEVELS } from "../src/game/levels/catalog";
import { DOOR_MOTION_MS } from "../src/game/engine/constants";
import { doorOpenAmount, easeGate, GateMotion, gateLeaves, gateRungs } from "../src/game/view/gateVisuals";

describe("compact gates", () => {
  it.each(LEVELS)("keeps every gate in room $id at most half a tile wide", (level) => {
    const gates = [
      ...level.gatedSolids,
      ...(level.holdGates ?? []).flatMap(g => g.rects),
      ...(level.phaseGates ?? []).flatMap(g => g.rects),
      ...(level.gear?.windows ?? []).flatMap(g => g.solidsWhenClosed),
    ];
    for (const gate of gates) {
      expect(gate.w).toBeLessThanOrEqual(24);
      expect(gate.h).toBeGreaterThan(0);
    }
    expect(level.gatedSolids[0].x + level.gatedSolids[0].w / 2).toBeCloseTo(20.45 * 48);
    expect(level.gatedSolids[0].y).toBeCloseTo(33.6);
    expect(level.gatedSolids[0].h).toBeCloseTo(369.6);
    for (const gate of level.holdGates ?? []) {
      for (const rect of gate.rects) expect(rect.y).toBeCloseTo(5.6 * 48);
    }
  });

  it("clips both leaves and all moving rungs inside the collision footprint", () => {
    const rect = { x: 10, y: 20, w: 24, h: 369.6 };
    for (let i = 0; i <= 100; i++) {
      const progress = i / 100;
      for (const part of [...gateLeaves(rect, progress), ...gateRungs(rect, progress)]) {
        expect(part.x).toBeGreaterThanOrEqual(rect.x);
        expect(part.y).toBeGreaterThanOrEqual(rect.y);
        expect(part.x + part.w).toBeLessThanOrEqual(rect.x + rect.w);
        expect(part.y + part.h).toBeLessThanOrEqual(rect.y + rect.h + 1e-9);
      }
      const leaves = gateLeaves(rect, progress);
      if (leaves.length) {
        expect(leaves[1].y - (leaves[0].y + leaves[0].h)).toBeCloseTo(rect.h * progress);
      }
    }
    expect(gateLeaves(rect, 1)).toEqual([]);
    expect(gateRungs(rect, 1)).toEqual([]);
    expect(gateLeaves(rect, -1)).toEqual(gateLeaves(rect, 0));
    expect(gateLeaves(rect, 2)).toEqual([]);
  });

  it("eases the timed door symmetrically with stable endpoints", () => {
    expect(easeGate(0.05)).toBeLessThan(0.05);
    expect(easeGate(0.95)).toBeGreaterThan(0.95);
    for (const t of [0, 0.1, 0.5, 0.9, 1]) {
      const opening = doorOpenAmount({ doorPhase: "opening", doorMotionMs: DOOR_MOTION_MS * (1 - t), doorOpen: true });
      const closing = doorOpenAmount({ doorPhase: "closing", doorMotionMs: DOOR_MOTION_MS * t, doorOpen: true });
      expect(opening).toBeCloseTo(closing);
    }
    expect(doorOpenAmount({ doorPhase: "closed", doorMotionMs: 0, doorOpen: false })).toBe(0);
    expect(doorOpenAmount({ doorPhase: "open", doorMotionMs: 0, doorOpen: true })).toBe(1);
    expect(doorOpenAmount({ doorPhase: "opening", doorMotionMs: 450, doorOpen: true }, true)).toBe(1);
  });

  it("reverses without jumping and freezes with the simulation clock", () => {
    const motion = new GateMotion();
    expect(motion.sample("gate", false, 0)).toBe(0);
    expect(motion.sample("gate", true, 10)).toBe(0);
    expect(motion.sample("gate", true, 90)).toBeCloseTo(0.5);
    expect(motion.sample("gate", true, 90)).toBeCloseTo(0.5);
    expect(motion.sample("gate", false, 90)).toBeCloseTo(0.5);
    expect(motion.sample("gate", false, 170)).toBeCloseTo(0.25);
    expect(motion.sample("gate", false, 250)).toBe(0);
  });

  it("starts each gate at its true state and resets on restart or reduced motion", () => {
    const motion = new GateMotion();
    expect(motion.sample("open", true, 100)).toBe(1);
    expect(motion.sample("closed", false, 100)).toBe(0);
    expect(motion.sample("closed", true, 200)).toBe(0);
    expect(motion.sample("closed", true, 210, true)).toBe(1);
    expect(motion.sample("closed", false, 220, true)).toBe(0);
    expect(motion.sample("open", false, 0)).toBe(0);
    motion.clear();
    expect(motion.sample("closed", true, 300)).toBe(1);
  });
});
