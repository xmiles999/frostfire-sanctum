import { useEffect, useRef, useState } from "react";
import { GameRuntime, type HudModel } from "../game/runtime";
import { GameView } from "../game/view/GameView";
import { loadSave } from "../game/systems/save";

type Page = "title" | "howto" | "play";

export function App() {
  const [page, setPage] = useState<Page>("title");
  const [save] = useState(() => loadSave());
  if (page === "howto") return <HowTo onBack={() => setPage("title")} onPlay={() => setPage("play")} />;
  if (page === "play") return <Play onExit={() => setPage("title")} />;
  return (
    <div className="screen" style={{ backgroundImage: "url(/assets/levels/01/bg-far.jpg)" }}>
      <h1>霜焰双行</h1>
      <p className="sub">林渊圣所 · 第 1 关竖切</p>
      <p className="sub">烬 WASD + J　朔 方向键 + ;</p>
      <div className="actions">
        <button className="btn ember" onClick={() => setPage("play")}>
          进入裂隙初醒
        </button>
        <button className="btn frost" onClick={() => setPage("howto")}>
          操作说明
        </button>
      </div>
      <p className="sub" style={{ marginTop: 28 }}>
        已解锁 {save.progress.unlockedCount} / 18　（其余关卡属阶段 D）
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
        <p>
          第 1 关：先用烬把寻热残烬引到熔岩边，朔再过廊。蒸汽喷发前金属盖会震颤——白雾未尽不要冲。两人同时踩压板 0.8 秒后门只开 5 秒，分路冲壁龛。
        </p>
        <p>
          <kbd>Esc</kbd> 暂停，<kbd>R</kbd> 重开。没有检查点。单人倒地有 8 秒救援窗（祭坛）。
        </p>
      </div>
      <div className="actions">
        <button className="btn" onClick={onBack}>
          返回
        </button>
        <button className="btn ember" onClick={onPlay}>
          开始
        </button>
      </div>
    </div>
  );
}

function Play({ onExit }: { onExit: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rtRef = useRef<GameRuntime | null>(null);
  const [hud, setHud] = useState<HudModel | null>(null);
  const [paused, setPaused] = useState(false);
  const [boot, setBoot] = useState<"loading" | "ready" | "error">("loading");
  const [bootError, setBootError] = useState("");

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const rt = new GameRuntime();
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
    const clearInput = () => rt.input.clear();
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
  }, []);

  const status = hud?.status;
  return (
    <div className="play" ref={wrapRef}>
      <canvas ref={canvasRef} />
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
          <div className="tag">{hud?.title ?? "裂隙初醒"}</div>
          <div className="tag">{formatTime(hud?.timeMs ?? 0)} · 死亡 {hud?.deaths ?? 0}</div>
          <div className="tag">蒸汽 {steamLabel(hud?.steamPhase)}</div>
          <div className={`tag ${hud?.doorOpen ? "door-live" : ""}`}>
            闩锁 {doorLabel(hud)}
          </div>
        </div>
        <div className="hud-bot">
          <div className={`tag ember`}>烬 {hud?.plateEmber ? "压板" : "行动"}</div>
          {hud?.separated ? <div className="tag warn">失联 · 远端减速</div> : <div />}
          <div className={`tag frost`}>朔 {hud?.plateFrost ? "压板" : "行动"}</div>
        </div>
      </div>
      {hud?.status === "rescue_window" && (
        <div className="tag warn" style={{ position: "absolute", top: 64, left: "50%", transform: "translateX(-50%)" }}>
          救援 {Math.ceil((hud.rescueMs ?? 0) / 1000)}s · 另一人到祭坛按交互
        </div>
      )}
      {(paused || status === "failed" || status === "cleared") && (
        <div className="overlay">
          <h2>{status === "cleared" ? "圣所暂歇" : status === "failed" ? "裂隙吞没" : "暂停"}</h2>
          {status === "cleared" && <p>{hud?.stars} 星 · {formatTime(hud?.timeMs ?? 0)}</p>}
          <div className="actions">
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
              离开
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

function steamLabel(phase?: string): string {
  if (phase === "telegraph") return "预示";
  if (phase === "lethal") return "喷发";
  return "安全窗";
}

function doorLabel(hud: HudModel | null): string {
  if (!hud?.doorOpen) return "待命";
  if (hud.doorPhase === "opening") return "开启";
  if (hud.doorPhase === "closing") return "闭合";
  return `${Math.max(0, hud.latchMs / 1000).toFixed(1)}s`;
}
