import { expect, it } from "vitest";
import { GameRuntime } from "../src/game/runtime";

it("pause/resume preserves an active rescue window and clears held keys", () => {
  const runtime = new GameRuntime();
  runtime.sim.status = "rescue_window";
  runtime.sim.rescueMs = 3600;
  runtime.input.down("KeyD");
  runtime.pause();
  expect(runtime.sim.status).toBe("paused");
  expect(runtime.input.keys.size).toBe(0);
  runtime.resume();
  expect(runtime.sim.status).toBe("rescue_window");
  expect(runtime.sim.rescueMs).toBe(3600);
});
