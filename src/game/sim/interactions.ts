import { rectsOverlap, type Rect } from "../engine/aabb";
import { IGNITE_RANGE, TILE } from "../engine/constants";
import { actorRect } from "../engine/physics";
import { standingOnPlate } from "./world";
import { steamAt } from "./steam";
import type { ActorState, BridgeSeg, SimState } from "./types";

export function nearInteraction(actor: ActorState, rect: Rect, pad = 18): boolean {
  return !actor.downed && rectsOverlap(actorRect(actor), {
    x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2,
  });
}

export function canIgnite(actor: ActorState, bridge: BridgeSeg): boolean {
  return !actor.downed && actor.id === "ember" && bridge.oily
    && Math.abs(actor.x + actor.w / 2 - bridge.rect.x - bridge.rect.w / 2) <= 2.2 * TILE
    && Math.abs(actor.y + actor.h / 2 - bridge.rect.y - bridge.rect.h / 2) <= IGNITE_RANGE;
}

export function interactionLabel(sim: SimState, who: "ember" | "frost"): string {
  const actor = sim[who];
  const key = who === "ember" ? "J" : ";";
  if (actor.downed) return "已倒地 · 等待同伴祭坛救援";
  const partner = sim[who === "ember" ? "frost" : "ember"];
  if (partner.downed && rectsOverlap(actorRect(actor), sim.level.altar)) {
    return sim.chargeLeft > 0 ? `${key} 祭坛救援 · 消耗 1 电荷` : "祭坛电荷已耗尽";
  }
  for (const spec of sim.level.fragilePlatforms ?? []) {
    const state = sim.fragilePlatforms.find(p => p.id === spec.id);
    if (state?.phase === "cracking" && standingOnPlate(actor, spec.rect)) {
      return `碎台 ${(state.remainingMs / 1000).toFixed(1)}s 后坍塌 · 跳离`;
    }
  }
  const lever = sim.level.levers?.find(l => nearInteraction(actor, l.rect));
  if (lever) return lever.kind === "tide" ? `${key} 拨至${["深", "浅", "中"][sim.tideLevel]}水位` : `${key} ${sim.gearArmedMs === null ? "启动" : "重置"}齿轮`;
  if (sim.level.bridges?.some(b => canIgnite(actor, b) && !sim.bridges.find(r => r.id === b.id)?.ignited)) {
    return `${key} 点燃油桥 · 先确认朔已过桥`;
  }
  if (actor.pushing) return "正在推箱 · 松开方向键停止";
  if (sim.level.holdGates?.some(g => (g.who === who || g.who === "any") && standingOnPlate(actor, g.plate))) {
    return "接应门已开 · 留在板上等同伴通过";
  }
  const hazard = sim.level.hazards.find(h =>
    (h.type === "steam_hot" || h.type === "ice_mist") && nearInteraction(actor, h.rect, 40));
  if (hazard?.type === "ice_mist") return who === "ember" ? "前方寒气区 · 烬禁入，跳过缺口" : "寒气区 · 朔可安全通过";
  if (hazard?.type === "steam_hot") {
    if (who === "ember") return "热汽对烬安全 · 可以接应同伴";
    const steam = steamAt(sim.timeMs);
    return steam.phase === "safe" ? `喷口冷却 · ${(steam.remainMs / 1000).toFixed(1)}s 后蓄压`
      : steam.phase === "telegraph" ? "喷口蓄压 · 朔请退后" : "喷口喷发 · 朔等待冷却";
  }
  return who === "ember" ? "S 精准慢行 · 熔岩安全" : "↓ 精准慢行 · 水域安全";
}

export function notify(sim: SimState, text: string): void {
  sim.feedback = { text, remainingMs: 1800 };
}
