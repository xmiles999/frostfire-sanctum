import { useEffect, useRef, useState } from "react";
import { GameRuntime, type HudModel } from "../game/runtime";
import { GameView } from "../game/view/GameView";
import { loadSave } from "../game/systems/save";
import { LEVELS } from "../game/levels/catalog";
import { CHAPTERS } from "../game/levels/layout";
import { LevelPreview } from "./LevelPreview";

type Page = "title" | "howto" | "select" | "play";

export function App() {
  const [page, setPage] = useState<Page>("title");
  const [save, setSave] = useState(() => loadSave());
  const [levelId, setLevelId] = useState("01");
  if (page === "howto") return <HowTo onBack={() => setPage("title")} onPlay={() => setPage("select")} />;
  if (page === "select") {
    return (
      <Select
        save={save}
        onBack={() => setPage("title")}
        onPick={(id) => {
          setLevelId(id);
          setPage("play");
        }}
      />
    );
  }
  if (page === "play") {
    return (
      <Play
        key={levelId}
        levelId={levelId}
        onNext={() => {
          const next = LEVELS[LEVELS.findIndex(l => l.id === levelId) + 1];
          if (next) { setSave(loadSave()); setLevelId(next.id); }
        }}
        onExit={() => {
          setSave(loadSave());
          setPage("select");
        }}
      />
    );
  }
  return (
    <div className="screen" style={{ backgroundImage: "url(/assets/levels/01/bg-far.jpg)" }}>
      <h1>霜焰双行</h1>
      <p className="sub">林渊圣所 · 双人协作解谜</p>
      <p className="sub">烬 WASD + J　朔 方向键 + ;</p>
      <div className="actions">
        <button className="btn ember" onClick={() => setPage("select")}>
          选关
        </button>
        <button className="btn frost" onClick={() => setPage("howto")}>
          操作说明
        </button>
      </div>
      <p className="sub" style={{ marginTop: 28 }}>
        已解锁 {Math.min(LEVELS.length, save.progress.unlockedCount)} / {LEVELS.length} · 林渊篇
      </p>
    </div>
  );
}

function HowTo({ onBack, onPlay }: { onBack: () => void; onPlay: () => void }) {
  return (
    <div className="screen">
      <h1>操作</h1>
      <div className="howto">
        <p>同一画面同时控制两人。烬走熔岩、怕水；朔走水、怕熔岩与过热蒸汽。</p>
        <p>
          烬：<kbd>W A S D</kbd> 移动跳跃，<kbd>J</kbd> 交互。朔：<kbd>↑ ← ↓ →</kbd>，<kbd>;</kbd> 交互。
        </p>
        <p>开启出口需要两枚带外框的分色符文，有些符文需要先启动机关才能到达。普通晶石是支路挑战，集齐才有机会获得三星。晶石与符文只能由同色角色拾取。</p>
        <p>观察整间神殿，利用阶梯与折返平台规划路线。五关依次练习：元素分工、潮位推箱、木桥退路、反相双闸、齿轮时序。</p>
        <p>
          关卡左上有 <strong>返回 / 暂停 / 重开</strong>。<kbd>Esc</kbd> 暂停，游玩中长按 <kbd>R</kbd> 0.4 秒重开，暂停或结算时点按 <kbd>R</kbd> 立即重开。1–8 关没有检查点。单人倒地有 8 秒救援窗（祭坛）。
        </p>
      </div>
      <div className="actions">
        <button className="btn" onClick={onBack}>
          返回
        </button>
        <button className="btn ember" onClick={onPlay}>
          选关
        </button>
      </div>
    </div>
  );
}

function Select({
  save,
  onBack,
  onPick,
}: {
  save: ReturnType<typeof loadSave>;
  onBack: () => void;
  onPick: (id: string) => void;
}) {
  return (
    <div className="screen">
      <h1>林渊圣所</h1>
      <p className="sub">五间神殿，五种协作方式。通关解锁下一关。</p>
      <div className="level-grid">
        {LEVELS.map((level, index) => {
          const unlocked = index < save.progress.unlockedCount;
          const rec = save.progress.levels[level.id];
          return (
            <button
              key={level.id}
              className={`level-card ${unlocked ? "" : "locked"}`}
              disabled={!unlocked}
              onClick={() => unlocked && onPick(level.id)}
            >
              <LevelPreview level={level} />
              <span className="level-id">第 {level.id} 关 · {CHAPTERS[level.id].theme}</span>
              <span className="level-title">{level.title}</span>
              <span className="level-meta">
                {unlocked ? (rec?.cleared ? `${rec.stars} 星` : "未通关") : "未解锁"}
              </span>
              <span className="level-goal">{CHAPTERS[level.id].goal}</span>
            </button>
          );
        })}
      </div>
      <div className="actions" style={{ marginTop: 28 }}>
        <button className="btn" onClick={onBack}>
          返回
        </button>
      </div>
    </div>
  );
}

function Play({ levelId, onExit, onNext }: { levelId: string; onExit: () => void; onNext: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rtRef = useRef<GameRuntime | null>(null);
  const [hud, setHud] = useState<HudModel | null>(null);
  const [paused, setPaused] = useState(false);
  const [boot, setBoot] = useState<"loading" | "ready" | "error">("loading");
  const [bootError, setBootError] = useState("");
  const [showTip, setShowTip] = useState(false);
  const chapter = CHAPTERS[levelId];

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const rt = new GameRuntime();
    rt.load(levelId);
    rtRef.current = rt;
    rt.onHud = setHud;
    const ac = new AbortController();
    void GameView.create(canvas, wrap, ac.signal)
      .then((view) => {
        if (ac.signal.aborted) {
          view.destroy();
          return;
        }
        rt.attach(view);
        setBoot("ready");
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
        const msg = err instanceof Error ? err.message : String(err);
        setBootError(msg);
        setBoot("error");
      });
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.code === "Enter") && e.target instanceof HTMLElement && e.target.closest("button")) return;
      if (
        e.code === "ArrowLeft" ||
        e.code === "ArrowRight" ||
        e.code === "ArrowUp" ||
        e.code === "ArrowDown" ||
        e.code === "Space"
      ) {
        e.preventDefault();
      }
      if (e.code === "Escape") {
        e.preventDefault();
        if (rt.sim.status === "paused") {
          rt.resume();
          setPaused(false);
        } else if (rt.sim.status === "playing" || rt.sim.status === "rescue_window") {
          rt.pause();
          setPaused(true);
        }
        return;
      }
      if (e.code === "KeyR" && (rt.sim.status === "paused" || rt.sim.status === "failed" || rt.sim.status === "cleared")) {
        rt.restart();
        setPaused(false);
        return;
      }
      if (e.repeat) return;
      rt.input.down(e.code);
    };
    const onUp = (e: KeyboardEvent) => rt.input.up(e.code);
    const clearInput = () => {
      rt.input.clear();
      if (rt.sim.status === "playing" || rt.sim.status === "rescue_window") {
        rt.pause();
        setPaused(true);
      }
    };
    const onVisibility = () => {
      if (document.hidden) clearInput();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", clearInput);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      ac.abort();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", clearInput);
      document.removeEventListener("visibilitychange", onVisibility);
      rt.detach();
    };
  }, [levelId]);

  const status = hud?.status;
  return (
    <div className="play">
      <div className="game-stage" ref={wrapRef}>
        <canvas ref={canvasRef} aria-label={`第 ${levelId} 关，${chapter.goal}。烬使用 WASD 和 J，朔使用方向键和分号。`} />
      </div>
      {boot === "loading" && (
        <div className="overlay">
          <h2>裂隙开启中</h2>
          <p>正在载入角色与场景…</p>
        </div>
      )}
      {boot === "error" && (
        <div className="overlay">
          <h2>无法进入关卡</h2>
          <p className="howto">{bootError}</p>
          <button className="btn" onClick={onExit}>
            返回
          </button>
        </div>
      )}
      <div className="hud">
        <div className="hud-top">
          <div className="hud-chrome">
            <button type="button" className="btn hud-btn" onClick={onExit}>
              返回
            </button>
            <button
              type="button"
              className="btn hud-btn"
              onClick={() => {
                const rt = rtRef.current;
                if (!rt) return;
                if (rt.sim.status === "paused") {
                  rt.resume();
                  setPaused(false);
                } else if (rt.sim.status === "playing" || rt.sim.status === "rescue_window") {
                  rt.pause();
                  setPaused(true);
                }
              }}
            >
              {paused ? "继续" : "暂停"} <kbd>Esc</kbd>
            </button>
            <button
              type="button"
              className="btn hud-btn ember"
              onClick={() => {
                rtRef.current?.restart();
                setPaused(false);
              }}
            >
              重开 <kbd>R</kbd>
              {(hud?.restartHeldMs ?? 0) > 0 && hud?.status === "playing" ? (
                <span className="hold-meter" style={{ width: `${Math.min(100, (hud.restartHeldMs / 400) * 100)}%` }} />
              ) : null}
            </button>
            <button type="button" className="btn hud-btn" aria-expanded={showTip} onClick={() => setShowTip(v => !v)}>提示</button>
          </div>
          <div className="hud-stats">
            <div className="level-heading"><span>林渊 / {levelId}</span><strong>{hud?.title ?? LEVELS.find(l => l.id === levelId)?.title}</strong></div>
            <div className="tag">{formatTime(hud?.timeMs ?? 0)} · 死亡 {hud?.deaths ?? 0}</div>
            <div className="tag gem-count">◇ 晶石 {hud?.gems.collected ?? 0}/{hud?.gems.total ?? 6}</div>
          </div>
        </div>
        <div className="objective-bar">
          <span>符文 {hud?.gems.runes ?? 0}/2</span>
          <span>{hud?.guidance.objective ?? chapter.goal}</span>
          <span className={hud?.doorOpen ? "door-live" : ""}>{`出口 · ${doorLabel(hud)}`}</span>
        </div>
        {showTip && <div className="level-tip" role="status">{chapter.tip}</div>}
        <div className="hud-bot">
          <div className="player-control ember"><strong>烬<small className="player-gems" aria-label={`烬已收集 ${hud?.gems.ember ?? 0} 件，共 3 件`}>◇ {hud?.gems.ember ?? 0}/3</small></strong><span><kbd>A</kbd><kbd>D</kbd> 移动　<kbd>W</kbd> 跳跃　<kbd>J</kbd> 交互</span><small>熔岩安全 · 避开水 / 冰雾</small></div>
          <div className="room-status"><span>{hud?.guidance.mechanism ?? "机关待命"}</span><small>{hud?.guidance.detail ?? "同色拾取 ◇ · 双人抵达出口"}</small></div>
          {hud?.separated ? <div className="tag warn">失联 · 远端减速</div> : null}
          <div className="player-control frost"><strong>朔<small className="player-gems" aria-label={`朔已收集 ${hud?.gems.frost ?? 0} 件，共 3 件`}>◇ {hud?.gems.frost ?? 0}/3</small></strong><span><kbd>←</kbd><kbd>→</kbd> 移动　<kbd>↑</kbd> 跳跃　<kbd>;</kbd> 交互</span><small>水域安全 · 避开熔岩 / 热蒸汽</small></div>
        </div>
        <div className="keyboard-notice">建议横屏并连接键盘，支持同机双人游玩</div>
      </div>
      {hud?.status === "rescue_window" && (
        <div className="tag warn" style={{ position: "absolute", top: 64, left: "50%", transform: "translateX(-50%)" }}>
          救援 {Math.ceil((hud.rescueMs ?? 0) / 1000)}s · 另一人到祭坛按交互
        </div>
      )}
      {(paused || status === "failed" || status === "cleared") && (
        <div className="overlay">
          <h2>{status === "cleared" ? "圣所暂歇" : status === "failed" ? "裂隙吞没" : "暂停"}</h2>
          {status === "cleared" && <p>{hud?.stars} 星 · {formatTime(hud?.timeMs ?? 0)} · 晶石 {hud?.gems.collected}/{hud?.gems.total}</p>}
          <div className="actions">
            {status === "cleared" && levelId !== "05" && <button className="btn frost" onClick={onNext}>下一关</button>}
            {status !== "cleared" && status !== "failed" && (
              <button
                className="btn"
                onClick={() => {
                  rtRef.current?.resume();
                  setPaused(false);
                }}
              >
                继续
              </button>
            )}
            <button
              className="btn ember"
              onClick={() => {
                rtRef.current?.restart();
                setPaused(false);
              }}
            >
              重开
            </button>
            <button className="btn" onClick={onExit}>
              返回选关
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function doorLabel(hud: HudModel | null): string {
  if (!hud?.doorOpen) return "待命";
  if (hud.doorPhase === "opening") return "开启";
  if (hud.doorPhase === "closing") return "闭合";
  return `${Math.max(0, hud.latchMs / 1000).toFixed(1)}s`;
}
