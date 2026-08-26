# dsh-grad-workbench — Graduate OS / 硕博工作台

> 一个 local-first 的 DeepSeek Harness（DSH）工作台：把硕博阶段的科研、沟通、生活、自动化任务组织成可组合的 Skills、Workflows、Memory 与 Connectors。
>
> 仓库架构对齐 `John030427/math-modeling-workbench` 的产品模式：**独立 profile + suite 聚合包 + 专属产品 Shell（接管 root 布局）+ 领域插件（兼容门控）+ 引导脚本**。

## 目标交付形态（对齐 math 数模工作台）

```text
~/.dsh/profiles/grad → dsh-base + dsh-web-app
                        + @grad/grad-suite        ← 单一产品 bundle
                            (组合 grad-shell + @grad/dsh-grad-workbench;
                             禁 ui-layout、shell 拥有 root)
启动: scripts/grad-start.ps1（默认端口 3101, --no-open）
```

- **grad-shell**（`packages/grad-shell`）：纯展示层产品 chrome —— 单一侧栏（概览/研究/沟通/生活/自动化/记忆/连接）+ 主导工作台 + 窄原生 Agent 列；主题自适应；模块求值时设 `window.__GRAD_SHELL_HOST__`，注册 `root` slot。
- **@grad/dsh-grad-workbench**（`packages/dsh-grad-workbench`）：领域插件 —— SQLite 迁移、工件、审批、工作流引擎、16+ `grad_*` 工具、`/api/grad/*` 路由、研究雷达、飞书连接器、沟通/生活/表单/技能 UI。客户端在 shell 宿主下跳过旧 Surface 的注册（兼容门控），在 stock web profile 下保留完整会话标签入口。
- **@grad/grad-suite**（`packages/grad-suite`）：composition-only 聚合包，patch 插入 shell + domain 并禁用 `ui-layout`。
- `scripts/`：`grad-profile-init.ps1`（幂等初始化）、`grad-profile-verify.ps1`、`grad-start.ps1`、`grad-remove.ps1`（web profile 永不触碰）。

## 快速开始

```powershell
# 0) 前置：已安装 DSH（@deepseek-ai/dsh 0.1.1-rc.2，Node 24）
cd C:\Users\Administrator\Projects\dsh-grad-workbench

# 1) 构建全部产品包 + 生成 grad profile
& scripts\grad-profile-init.ps1

# 2) 校验组合（只读 dump-config）
& scripts\grad-profile-verify.ps1

# 3) 启动产品实例（默认 :3101）
& scripts\grad-start.ps1 -Port 3101

# 4) 冒烟
node packages\dsh-grad-workbench\scripts\smoke.mjs 3101
```

打开 http://127.0.0.1:3101 —— 你看到的是单侧边栏 + 主导工作台 + 右侧窄 Agent 列的 Graduate OS 产品界面（区别于 stock DSH 的官方布局）。

## 领域插件开发 / 测试

```bash
cd packages/dsh-grad-workbench
npm run typecheck && npm test      # 63 项测试
node scripts/smoke.mjs 3101        # 对运行中的实例冒烟
```

## 测试与验证

| 命令 | 含义 |
|---|---|
| `npm run typecheck` | 领域包 `tsc --noEmit` |
| `npm test` | node --test 全量（单元 + 契约 + 集成） |
| `node scripts/smoke.mjs <port>` | 对运行实例探测 health / client bundle / index |

已实测：真实 OpenAlex 检索 → 去重 → 证据标注报告工件；S2 限流诚实降级；审批门控工作流（echo-demo / literature-radar / literature-to-feishu）；headless agent 调用 `grad_*` 工具；飞书连接器 mock 执行器全覆盖。

## 文档

- `docs/COMPATIBILITY.md` —— 本机 DSH rc.2 契约事实（工具参数须原始 JSON Schema、输出 lossless JSON、`root` slot 语义、suite/patch 组合、兼容门控）。
- `docs/PROGRESS.md` —— 阶段清单 / 检查点 / MVP 定义达成评审 / 待决策项（TTS 提供方、飞书 CLI 凭据等）。
- `docs/MVP_PRD.md` · `docs/DSH_DEVELOPMENT_PLAN.md` · `GOAL_PROMPT.md` —— 产品与工程原始定义。