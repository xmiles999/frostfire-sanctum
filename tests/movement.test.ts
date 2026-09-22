import { describe, expect, it } from "vitest";
import { EMBER_SPEED, JUMP_SPEED, PHYS_DT, TILE } from "../src/game/engine/constants";
import { integrateActor } from "../src/game/engine/physics";
import { createSim } from "../src/game/sim/create";
import { updateActorAnimation } from "../src/game/sim/animation";
import { actorPose } from "../src/game/view/actorPose";
import { blankLevel, idle, steps } from "./helpers";

describe("movement control", () => {
  it("accelerates instead of snapping to full speed and brakes within eight pixels", () => {
    const sim = createSim(blankLevel());
    const right = idle();
    right.ember.right = true;
    steps(sim, 1, right);
    expect(sim.ember.vx).toBeGreaterThan(0);
    expect(sim.ember.vx).toBeLessThan(EMBER_SPEED);
    steps(sim, 12, right);
    expect(sim.ember.vx).toBe(EMBER_SPEED);
    const x = sim.ember.x;
    steps(sim, 6);
    expect(sim.ember.vx).toBe(0);
    expect(sim.ember.x - x).toBeLessThan(8);
  });

  it("changes direction through a braking pose rather than an instant velocity flip", () => {
    const sim = createSim(blankLevel());
    const input = idle();
    input.ember.right = true;
    steps(sim, 30, input);
    input.ember.right = false;
    input.ember.left = true;
    steps(sim, 1, input);
    expect(sim.ember.vx).toBeGreaterThan(0);
    expect(sim.ember.anim).toBe("brake");
    steps(sim, 14, input);
    expect(sim.ember.vx).toBe(-EMBER_SPEED);
  });

  it("provides half-speed precision movement on the existing down key", () => {
    const fast = createSim(blankLevel());
    const slow = createSim(blankLevel());
    const start = fast.ember.x;
    const input = idle();
    input.ember.right = true;
    steps(fast, 120, input);
    input.ember.down = true;
    steps(slow, 120, input);
    expect(slow.ember.vx).toBe(EMBER_SPEED / 2);
    expect((slow.ember.x - start) / (fast.ember.x - start)).toBeCloseTo(0.5, 1);
  });

  it("retains coyote jumps inside 100ms but does not grant an unlimited midair jump", () => {
    const recent = createSim(blankLevel()).ember;
    const late = createSim(blankLevel()).ember;
    for (const [actor, delay] of [[recent, 8], [late, 16]] as const) {
      actor.onGround = true;
      for (let i = 0; i < delay; i++) integrateActor(actor, [], PHYS_DT, EMBER_SPEED, false, true, false);
      integrateActor(actor, [], PHYS_DT, EMBER_SPEED, false, true, true);
    }
    expect(recent.vy).toBe(-JUMP_SPEED);
    expect(late.vy).toBeGreaterThan(0);
  });

  it("keeps the existing reachable jump apex while speeding up the descent", () => {
    const sim = createSim(blankLevel());
    steps(sim, 2);
    const startY = sim.ember.y;
    const jump = idle();
    jump.ember.jump = true;
    let top = startY;
    for (let i = 0; i < 90; i++) {
      steps(sim, 1, jump);
      top = Math.min(top, sim.ember.y);
    }
    expect(startY - top).toBeGreaterThan(107);
    expect(startY - top).toBeLessThan(112);
    expect(sim.ember.onGround).toBe(true);
  });

  it("does not build horizontal velocity against a solid wall", () => {
    const sim = createSim(blankLevel());
    sim.ember.x = TILE;
    const input = idle();
    input.ember.left = true;
    steps(sim, 40, input);
    expect(sim.ember.x).toBe(TILE);
    expect(sim.ember.vx).toBe(0);
  });
});

describe("character action presentation", () => {
  it("starts a new action clock at zero and selects rising/apex/falling frames without looping", () => {
    const actor = createSim(blankLevel()).ember;
    actor.anim = "walk";
    actor.animTime = 12;
    actor.vy = -720;
    updateActorAnimation(actor, PHYS_DT);
    expect(actor.animTime).toBe(0);
    expect(actorPose(actor).frame).toBe(0);
    actor.vy = -20;
    actor.animTime = 10;
    expect(actorPose(actor).frame).toBe(2);
    actor.vy = 760;
    updateActorAnimation(actor, PHYS_DT);
    expect(actorPose(actor).frame).toBe(5);
    expect(actorPose(actor).loop).toBe(false);
  });

  it("plays hurt once and stays downed instead of restarting the hurt cycle", () => {
    const actor = createSim(blankLevel()).ember;
    actor.downed = true;
    actor.anim = "hurt";
    for (let i = 0; i < 240; i++) updateActorAnimation(actor, PHYS_DT);
    expect(actor.anim).toBe("downed");
    expect(actor.animTime).toBeGreaterThan(1);
    expect(actorPose(actor).loop).toBe(false);
  });

  it("scales walk cadence with actual speed and removes cosmetic deformation for reduced motion", () => {
    const actor = createSim(blankLevel()).ember;
    actor.onGround = true;
    actor.moveDir = 1;
    actor.vx = 175;
    actor.anim = "walk";
    updateActorAnimation(actor, 0.1);
    expect(actor.animTime).toBeCloseTo(0.05);
    actor.landMs = 120;
    actor.landImpact = 1;
    const normal = actorPose(actor);
    const reduced = actorPose(actor, true);
    expect(normal.scaleY).toBeLessThan(1);
    expect(reduced.scaleY).toBe(1);
    expect(reduced.rotation).toBe(0);
  });
});
