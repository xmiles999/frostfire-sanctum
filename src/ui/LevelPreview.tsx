import type { LevelDocument } from "../game/sim/types";

/** The level selector uses real geometry, not a decorative mock map. */
export function LevelPreview({ level }: { level: LevelDocument }) {
  return (
    <svg className="level-preview" viewBox={`0 0 ${level.size.w * level.tile} ${level.size.h * level.tile}`} aria-hidden="true">
      <rect width="100%" height="100%" fill="#141c20" />
      {level.solids.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="#696557" />)}
      {level.fragilePlatforms?.map(p => <rect key={p.id} x={p.rect.x} y={p.rect.y} width={p.rect.w} height={p.rect.h} fill="#b38e5d" stroke="#e9c991" strokeWidth="3" strokeDasharray="7 4" />)}
      {level.hazards.map(h => <rect key={h.id} x={h.rect.x} y={h.rect.y} width={h.rect.w} height={h.rect.h}
        fill={h.type.includes("lava") ? "#e68a58" : h.type === "steam_hot" ? "#d8a164" : "#78b5c5"}
        opacity={h.type === "ice_mist" ? ".3" : ".8"}
        stroke={h.type === "ice_mist" ? "#a5deef" : "none"} strokeWidth="2" strokeDasharray="5 4" />)}
      {(["ember", "frost"] as const).map(who => {
        const exit = level.exits[who];
        return <rect key={who} x={exit.x} y={exit.y} width={exit.w} height={exit.h} fill={who === "ember" ? "#ed9a67" : "#98d9ec"} />;
      })}
      {level.collectibles?.filter(g => g.required).map(g => <circle key={g.id} cx={g.rect.x + 10} cy={g.rect.y + 12} r="14" fill={g.who === "ember" ? "#ed9a67" : "#98d9ec"} />)}
    </svg>
  );
}
