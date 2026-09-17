const KEY = "frostfire.sanctum.v1";

export interface SaveV1 {
  version: 1;
  settings: { masterVolume: number; reduceParticles: boolean };
  progress: {
    unlockedCount: number;
    levels: Record<string, { cleared: boolean; stars: number; bestTimeMs: number; deaths: number }>;
  };
}

function defaults(): SaveV1 {
  return {
    version: 1,
    settings: { masterVolume: 0.8, reduceParticles: false },
    progress: { unlockedCount: 1, levels: {} },
  };
}

export function loadSave(): SaveV1 {
  if (typeof localStorage === "undefined") return defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as SaveV1;
    if (parsed.version !== 1) return defaults();
    return parsed;
  } catch {
    return defaults();
  }
}

export function writeSave(next: SaveV1): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function recordClear(levelId: string, stars: number, timeMs: number, deaths: number): SaveV1 {
  const save = loadSave();
  const prev = save.progress.levels[levelId];
  save.progress.levels[levelId] = {
    cleared: true,
    stars: Math.max(prev?.stars ?? 0, stars),
    bestTimeMs: prev ? Math.min(prev.bestTimeMs, timeMs) : timeMs,
    deaths,
  };
  const n = Number.parseInt(levelId, 10);
  if (!Number.isNaN(n)) save.progress.unlockedCount = Math.max(save.progress.unlockedCount, Math.min(18, n + 1));
  writeSave(save);
  return save;
}
