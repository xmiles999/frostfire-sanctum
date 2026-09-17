# src/

阶段 B 已放入引擎、第 1 关模拟、Pixi 呈现与 React 壳。

| 目录 | 阶段 B 起职责 |
|---|---|
| `game/engine/` | 固定时间步循环、输入、相机、碰撞 |
| `game/actors/` | 焰行者 / 霜行者、动画状态机 |
| `game/world/` | 材质、液体、伤害区、可逆地形 |
| `game/systems/` | 机关、解谜图、救援、评分 |
| `game/levels/` | 关卡 JSON schema 与 18 关数据 |
| `ui/` | React 壳：封面、选关、HUD、设置 |

契约见 `docs/接口文档.md` 与 `docs/数据模型.md`。
