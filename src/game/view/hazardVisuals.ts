import type { Rect } from "../engine/aabb";
import type { SteamPhase } from "../sim/types";

export const STEAM_STYLE = {
  safe: { label: "冷却 · 朔可过", color: 0x9ec6cb, particles: 2, alpha: 0.07, height: 20 },
  telegraph: { label: "蓄压 · 朔退后", color: 0xffd186, particles: 5, alpha: 0.13, height: 42 },
  lethal: { label: "喷发 · 朔禁入", color: 0xffaa72, particles: 12, alpha: 0.22, height: Infinity },
} as const;

/** Every puff fits inside the actual hazard; decorative clouds cannot imply phantom damage. */
export function steamParticles(rect: Rect, phase: SteamPhase, timeMs: number) {
  const style = STEAM_STYLE[phase];
  const height = Math.min(rect.h, style.height);
  return Array.from({ length: style.particles }, (_, i) => {
    const radius = Math.min(phase === "lethal" ? 5 + i % 4 : 2 + i % 2, rect.w / 4, height / 4);
    const spanX = Math.max(0, rect.w - radius * 2);
    const spanY = Math.max(0, height - radius * 2);
    const rise = ((timeMs * (phase === "lethal" ? 0.12 : 0.04) + i * 23) % Math.max(1, spanY));
    return {
      x: rect.x + radius + spanX * ((i * 0.381966 + 0.18) % 1),
      y: rect.y + rect.h - radius - rise,
      radius,
      alpha: style.alpha * (1 - rise / Math.max(1, spanY) * 0.65),
    };
  });
}
