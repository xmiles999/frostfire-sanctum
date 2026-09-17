import { TILE } from "./constants";
import type { SimState } from "../sim/types";

export interface Camera {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function makeCamera(w: number, h: number): Camera {
  return { x: 0, y: 0, w, h };
}

export function updateCamera(cam: Camera, sim: SimState, dt: number): void {
  const worldW = sim.level.size.w * TILE;
  const worldH = sim.level.size.h * TILE;
  const minX = Math.min(sim.ember.x, sim.frost.x);
  const maxX = Math.max(sim.ember.x + sim.ember.w, sim.frost.x + sim.frost.w);
  const minY = Math.min(sim.ember.y, sim.frost.y);
  const maxY = Math.max(sim.ember.y + sim.ember.h, sim.frost.y + sim.frost.h);
  const pad = 4 * TILE;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const targetX = Math.max(0, Math.min(worldW - cam.w, cx + pad / 4 - cam.w / 2));
  const targetY = Math.max(0, Math.min(worldH - cam.h, cy - cam.h / 2));
  const k = 1 - Math.exp(-10 * dt);
  cam.x += (targetX - cam.x) * k;
  cam.y += (targetY - cam.y) * k;
}

export function separated(sim: SimState): boolean {
  return Math.abs(sim.ember.x - sim.frost.x) > 28 * TILE;
}
