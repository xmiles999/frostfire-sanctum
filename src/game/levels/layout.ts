import { TILE } from "../engine/constants";
import type { Rect } from "../engine/aabb";
import type { Collectible, LevelDocument } from "../sim/types";

/** Authoring helpers: positions are in tiles; physical objects retain their own size. */
export const roomY = (y: number): number => y * 0.7;
export const R = (x: number, y: number, w: number, h: number): Rect => ({
  x: x * TILE, y: roomY(y) * TILE, w: w * TILE, h: h * 0.7 * TILE,
});

export function gem(id: string, who: "ember" | "frost", x: number, floor: number, required = false): Collectible {
  return { id, who, required, rect: { x: x * TILE - 10, y: floor * TILE - 30, w: 20, h: 24 } };
}

export const CHAPTERS: Record<string, { theme: string; goal: string; tip: string }> = {
  "01": { theme: "元素与分工", goal: "取回双符文 · 踩板接应 · 穿过蒸汽", tip: "烬先吸引残烬并压住铜板，朔再通过下层石门。蒸汽停歇时出发。" },
  "02": { theme: "潮位与配重", goal: "推箱入井 · 升潮沉箱 · 降潮会合", tip: "朔先把箱子推到井边，烬把潮位拨到深水；开门后调回中水，再到铜板接应。" },
  "03": { theme: "木桥与退路", goal: "碎台取晶 · 先过桥再点燃 · 灰烬接应", tip: "右侧裂纹悬台停留 0.9 秒会塌，取晶后及时跳回。先让朔越过木桥，烬再按 J 点燃；灰烬落定后接应同伴。" },
  "04": { theme: "反相与接力", goal: "碎台折返 · 朔先入水闸 · 换相接力", tip: "左侧悬台只支撑 0.65 秒，取晶后跳回。烬引走残烬，朔踩内环冰板换相；持续站在板上不会反复切换，离板后可再次触发。" },
  "05": { theme: "时序与同步", goal: "启动齿轮 · 中室攀台取符文 · 接力穿闸", tip: "烬取阁楼符文后启动拨杆；朔在首闸 1.4–2.8 秒窗口进入中室攀台取符文，再抓住末闸 3.6–6.4 秒窗口。错过可等下一轮，齿轮每 10 秒循环。" },
};

const BRANCHES = {
  "01": {
    steps: [{ x: 3.8, y: 11.9, w: 2 }, { x: 1.2, y: 10.5, w: 1.8 }, { x: 3.8, y: 9.1, w: 2.4 }],
    bonus: { x: 7, y: 8.65, w: 1.6 }, dropX: 3.4,
  },
  "02": {
    steps: [{ x: 3.8, y: 11.9, w: 1.8 }, { x: 6.2, y: 10.5, w: 1.8 }, { x: 3.8, y: 9.1, w: 2.4 }],
    bonus: { x: 1.2, y: 8.65, w: 1.8 }, dropX: 3.2,
  },
  "03": {
    steps: [{ x: 3.6, y: 11.9, w: 2 }, { x: 6.2, y: 10.5, w: 1.8 }, { x: 8.8, y: 9.1, w: 2.4 }],
    bonus: { x: 12, y: 8.65, w: 1.6 }, dropX: 8.3,
  },
  "04": {
    steps: [{ x: 3.6, y: 11.7, w: 2 }, { x: 5.7, y: 10.1, w: 1.8 }, { x: 3.2, y: 8.5, w: 2 }],
    bonus: { x: 1.1, y: 8.1, w: 1 }, dropX: 2.65,
  },
  "05": {
    steps: [{ x: 4, y: 12, w: 1.8 }, { x: 1.5, y: 10.7, w: 1.6 }, { x: 4.8, y: 9.4, w: 2.2 }],
    bonus: { x: 6.8, y: 8.9, w: 1.2 }, dropX: 3.5,
  },
};

export function branchLayout(id: string) {
  return BRANCHES[id as keyof typeof BRANCHES] ?? BRANCHES["01"];
}

/** Three reachable footholds make the lower route a climb-and-return puzzle. */
export function lowerBranch(variant: number): { solids: Rect[]; collectibles: Collectible[] } {
  const layout = branchLayout(String(variant).padStart(2, "0"));
  const ledge = (x: number, y: number, w: number): Rect => ({
    x: x * TILE, y: y * TILE, w: w * TILE, h: 14,
  });
  return {
    solids: [...layout.steps, layout.bonus].map(s => ledge(s.x, s.y, s.w)),
    collectibles: [
      ...(variant === 5 ? [] : [gem("frost-rune", "frost", layout.steps[2].x + 1, layout.steps[2].y, true)]),
      gem("frost-branch", "frost", layout.bonus.x + 0.8, layout.bonus.y),
    ],
  };
}

export function finishRoom(level: LevelDocument): LevelDocument {
  const branch = lowerBranch(Number(level.id));
  // Tighter optional three-star goals; running out never ends an otherwise valid attempt.
  level.score.starTimeMs = [120, 110, 100, 90, 80][Number(level.id) - 1] * 1000;
  // The former long shelf was not reachable and blocked the new staircase.
  level.solids = level.solids.filter(s => !(s.w > s.h && Math.abs(s.y - roomY(16) * TILE) < 1));
  const ceiling = level.solids.find(s => s.y === 0 && s.w > s.h);
  if (ceiling) ceiling.h = 12;
  // Upper collection routes must not allow hopping over a partner's closed lower gate.
  for (const gate of level.holdGates ?? []) {
    for (const rect of gate.rects) {
      const bottom = rect.y + rect.h;
      rect.y = 5.6 * TILE;
      rect.h = bottom - rect.y;
    }
  }
  level.solids.push(...branch.solids);
  if (level.id === "03" || level.id === "04") {
    const bonus = branch.solids.at(-1)!;
    level.solids = level.solids.filter(s => s !== bonus);
    level.fragilePlatforms = [{
      id: "bonus_crumble", rect: bonus,
      crumbleMs: level.id === "03" ? 900 : 650,
      respawnMs: 2200,
    }];
  }
  if (level.id === "04") {
    for (const gate of level.phaseGates ?? []) {
      if (gate.side !== "water") continue;
      for (const rect of gate.rects) {
        const bottom = rect.y + rect.h;
        rect.y = 5.6 * TILE;
        rect.h = bottom - rect.y;
      }
    }
  }
  // Slim the actual obstacle as well as its art. Keep its centre and anti-bypass height.
  const gateRects = [
    ...level.gatedSolids,
    ...(level.holdGates ?? []).flatMap(g => g.rects),
    ...(level.phaseGates ?? []).flatMap(g => g.rects),
    ...(level.gear?.windows ?? []).flatMap(g => g.solidsWhenClosed),
  ];
  for (const rect of gateRects) {
    const width = Math.min(rect.w, TILE * 0.5);
    rect.x += (rect.w - width) / 2;
    rect.w = width;
  }
  if (level.id === "05") {
    level.solids.push({ x: 10.2 * TILE, y: 11.7 * TILE, w: 1.8 * TILE, h: 14 });
    branch.collectibles.push(gem("frost-rune", "frost", 11.1, 11.7, true));
  }
  if (level.id === "03" || level.id === "04") {
    const x = level.id === "03" ? 5.8 : 6.6;
    level.solids.push({ x: x * TILE, y: 4.2 * TILE, w: 1.6 * TILE, h: 14 });
    const upper = level.solids.find(s => s.x === TILE && Math.abs(s.y - 2.8 * TILE) < 1);
    if (upper) upper.w = (level.id === "03" ? 3.8 : 4.8) * TILE;
  }
  const routeGem = level.id === "01" ? { x: 10.5, y: 2.8 }
    : level.id === "02" ? { x: 15, y: 2.8 }
    : level.id === "05" ? { x: 13, y: 5.6 }
    : { x: 11.4, y: 5.6 };
  level.collectibles = [
    ...branch.collectibles,
    gem("ember-rune", "ember", 4.3, 2.8, true),
    gem("ember-route", "ember", routeGem.x, routeGem.y),
    gem("ember-return", "ember", 18.5, level.id === "02" ? 2.8 : 5.6),
    gem("frost-route", "frost", 18.6, 13.3),
  ];
  return level;
}
