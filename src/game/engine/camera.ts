import { TILE } from "./constants";
import type { SimState } from "../sim/types";

export interface Camera {
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
  ox: number;
  oy: number;
}

export function makeCamera(w: number, h: number): Camera {
  return { x: 0, y: 0, w, h, scale: 1, ox: 0, oy: 0 };
}

/** Fit the whole room on screen. Forest Ice Fire–style: no scrolling. */
export function updateCamera(cam: Camera, sim: SimState, _dt: number): void {
  const worldW = sim.level.size.w * TILE;
  const worldH = sim.level.size.h * TILE;
  const scale = Math.min(cam.w / Math.max(1, worldW), cam.h / Math.max(1, worldH));
  cam.scale = scale;
  cam.ox = (cam.w - worldW * scale) / 2;
  cam.oy = (cam.h - worldH * scale) / 2;
  cam.x = 0;
  cam.y = 0;
}

export function separated(sim: SimState): boolean {
  return Math.abs(sim.ember.x - sim.frost.x) > 28 * TILE;
}
