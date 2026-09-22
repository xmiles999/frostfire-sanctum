import { BRIDGE_BURN_MS, TILE } from "../engine/constants";
import { steamAt } from "./steam";
import type { SimState } from "./types";
import { gateOccupied, runesReady } from "./world";

export interface RoomGuidance {
  objective: string;
  mechanism: string;
  detail: string;
}

const seconds = (ms: number) => `${(Math.max(0, ms) / 1000).toFixed(1)}s`;

/** Read-only presentation derived from the same simulation clock as the mechanisms. */
export function roomGuidance(sim: SimState): RoomGuidance {
  const steam = steamAt(sim.timeMs);
  const result: RoomGuidance = {
    objective: "烬踩接应板，朔通过后两人去终点压板",
    mechanism: `蒸汽${steam.phase === "safe" ? "安全窗" : steam.phase === "telegraph" ? "即将喷发" : "喷发中"} · ${seconds(steam.remainMs)}`,
    detail: steam.phase === "safe" ? "留足穿越时间，安全窗结束前离开" : "朔在蒸汽区外等待",
  };
  const missing = (sim.level.collectibles ?? []).filter(g => g.required && !sim.collected.includes(g.id));
  if (missing.length) result.objective = `${missing.map(g => g.who === "ember" ? "烬" : "朔").join("、")}攀台取回带框符文`;

  if (sim.level.puzzle === "tide") {
    result.mechanism = `潮位 · ${["浅水", "中水", "深水"][sim.tideLevel]}`;
    result.detail = "烬碰拨杆换潮 · 深水沉箱，中水通行";
    if (runesReady(sim)) result.objective = "朔推箱入井，烬调到深水沉箱开闩";
  }
  if (sim.level.puzzle === "burn") {
    const bridge = sim.bridges.find(b => sim.level.bridges?.some(s => s.id === b.id && s.oily));
    if (bridge && !bridge.collapsed) {
      result.mechanism = bridge.ignited ? `油桥烧塌 · ${seconds(BRIDGE_BURN_MS - bridge.burnMs)}` : "油桥尚未点燃";
      result.detail = bridge.ignited ? "灰烬形成后再接应同伴" : "先让朔通过木桥，再由烬按 J";
      if (runesReady(sim)) result.objective = bridge.ignited ? "等待灰烬，准备在右侧接应" : "朔先过桥，烬再点燃油桥";
    }
  }
  if (sim.level.puzzle === "phase") {
    result.mechanism = sim.phase === 0 ? "火闸开 · 水闸闭" : "水闸开 · 火闸闭";
    result.detail = sim.phaseLockMs > 0 ? `相位锁定 · ${seconds(sim.phaseLockMs)}` : "内环压板保持 0.8s 切换闸门";
    if (runesReady(sim)) result.objective = sim.phase === 1 ? "朔进入水闸，踩内环冰板换相" : "烬进入火闸，压板接应朔";
  }
  if (sim.level.puzzle === "gear" && sim.level.gear) {
    if (sim.gearArmedMs === null) {
      result.mechanism = "齿轮未启动";
      result.detail = "烬在上层拨杆按 J · 左侧晶石可选";
      result.objective = sim.collected.includes("ember-rune") ? "烬按 J 启动齿轮，朔准备穿首闸" : "烬取阁楼符文，再到拨杆按 J";
    } else {
      if (!sim.collected.includes("frost-rune")) {
        result.objective = sim.frost.x < 9.5 * TILE ? "朔等待首闸，穿入中室" : "朔跳上中室石台，取冰符文";
      }
      const next = sim.level.gear.windows.find(w => {
        const actor = w.id === "fire" ? sim.ember : sim.frost;
        return w.solidsWhenClosed.some(r => actor.x < r.x + r.w);
      });
      if (next) {
        const t = sim.gearArmedMs;
        const name = next.id === "fire" ? "火闸" : next.id === "frost_early" ? "首闸" : "末闸";
        const open = t >= next.openAtMs && t < next.closeAtMs;
        const untilOpen = t < next.openAtMs ? next.openAtMs - t : (sim.level.gear.cycleMs ?? 10000) - t + next.openAtMs;
        result.mechanism = `${name} · ${open ? `可通过 ${seconds(next.closeAtMs - t)}` : gateOccupied(sim, next.solidsWhenClosed) ? "门洞有人，延迟关闭" : `${seconds(untilOpen)} 后开启`}`;
        result.detail = "同一齿轮循环驱动 · 错过可等下一轮";
      } else {
        result.mechanism = "时序门已通过";
        result.detail = "烬留在接应板，等朔穿过下层门";
      }
    }
  }
  if (sim.doorOpen) {
    result.objective = sim.level.puzzle === "tide" && sim.tideLevel !== 1
      ? "烬把潮位降到中水，再到出口会合"
      : "两人分别进入同色出口";
  }
  if (sim.status === "rescue_window") result.objective = "同伴倒地 · 另一人到祭坛按交互救援";
  if (sim.status === "cleared") result.objective = "双人已会合 · 本关完成";
  return result;
}
