import {
  STEAM_CYCLE_MS,
  STEAM_LETHAL_MS,
  STEAM_SAFE_MS,
  STEAM_TELEGRAPH_MS,
} from "../engine/constants";
import type { SteamPhase } from "./types";

export function steamAt(timeMs: number): { phase: SteamPhase; phaseMs: number; remainMs: number } {
  const t = ((timeMs % STEAM_CYCLE_MS) + STEAM_CYCLE_MS) % STEAM_CYCLE_MS;
  if (t < STEAM_SAFE_MS) {
    return { phase: "safe", phaseMs: t, remainMs: STEAM_SAFE_MS - t };
  }
  if (t < STEAM_SAFE_MS + STEAM_TELEGRAPH_MS) {
    const phaseMs = t - STEAM_SAFE_MS;
    return {
      phase: "telegraph",
      phaseMs,
      remainMs: STEAM_TELEGRAPH_MS - phaseMs,
    };
  }
  const phaseMs = t - STEAM_SAFE_MS - STEAM_TELEGRAPH_MS;
  return { phase: "lethal", phaseMs, remainMs: STEAM_LETHAL_MS - phaseMs };
}
