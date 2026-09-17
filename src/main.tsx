import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import "./ui/styles.css";

const el = document.getElementById("root");
if (!el) throw new Error("missing #root");
// Pixi 会占用同一块 canvas；StrictMode 双挂载会拆掉 WebGL 视图导致黑屏。
createRoot(el).render(<App />);
