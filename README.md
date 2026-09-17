# 霜焰双行（Frostfire Sanctum）

纯前端双人协作解谜平台跳跃。同一画面控制焰行者与霜行者，用水火对立规则、时序机关和场景可读线索过关。视觉走风格化写实，不用像素块堆角色或地图。

**当前状态：阶段 B 竖切。** 第 1 关「裂隙初醒」可玩。其余 17 关仍是规格，未实现。

## 文档

从 [docs/README.md](docs/README.md) 进入全部中文文档。

## 技术选型（已定）

- React 19 + TypeScript + Vite：站点壳、菜单、HUD、设置
- PixiJS 8：高分辨率精灵、视差、滤镜与动态光
- 自研固定时间步物理：平台跳跃手感与元素规则，不依赖 Arcade/Matter 作为玩法真相
- 关卡 JSON 数据驱动；进度存 `localStorage`，可导出/导入
- Dokploy：多阶段 Docker 构建 + Caddy 静态托管 + `/healthz`

## 启动

```bash
./scripts/dev.sh      # 开发，默认 5173
./scripts/start.sh    # 构建并预览，默认 4173
npm test              # 逻辑层测试（不启动页面）
```

烬：`WASD` + `J`。朔：方向键 + `;`。`Esc` 暂停，`R` 在暂停/结算时重开。

Dokploy：Git 应用 + 仓库根 `Dockerfile`，容器端口 **3000**，健康检查 `/healthz`，不要把 3000 映射到公网。步骤见 [docs/部署运维.md](docs/部署运维.md)。

## 许可

项目内原创关卡规格与代码默认私有，待实现时再补 LICENSE。
