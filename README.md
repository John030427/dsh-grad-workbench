# dsh-grad-workbench

> **Graduate OS / 硕博工作台** — a local-first DeepSeek Harness workbench that turns graduate-school tasks into composable Skills, Workflows, Memory and Connectors.

## Product thesis

The product does **not** try to answer “which LLM is globally best for this prompt?”.  
It first identifies the **task/workflow**, then lets each Skill declare the capabilities, tools, memory and model policy it needs.

```text
User / Feishu / WeChat / file / screenshot
                    │
              Universal Inbox
                    │
               Task Router
                    │
     ┌──────────────┼──────────────┐
 Research       Communication      Life       Automation
     │                │             │              │
     └────────────── Skills / Workflow ────────────┘
                         │
       ┌─────────────────┼─────────────────┐
       Memory         Connectors       Model Policy
                         │
                      DSH Core
```

## MVP spaces

- **Research** — Latest-50 literature radar, paper collections, synthesis with citations, Feishu publishing, audio brief.
- **Communication** — advisor/teacher message understanding, reply drafting, progress/meeting/defense communication.
- **Life** — Food Map, Fitness Log, Volunteer/Activity Ledger.
- **Automation** — Form Assistant, Skill Studio, reusable workflow recipes.

## Core platforms

- **DSH-native**: keep the native Agent / Session / Tool pipeline. Do not fork DSH core.
- **Local-first**: SQLite + artifact workspace; explicit scopes and provenance for memory.
- **Connector-first**: Feishu/Lark first-class; WeChat behind an adapter/feature flag; future Slack/Telegram/etc.
- **Human approval for side effects**: sending messages, submitting forms, publishing, deleting, overwriting and other irreversible actions always require explicit approval.
- **Traceable workflows**: every workflow run records inputs, tool calls, artifacts, model policy, sources and side effects.

## Documents

- `docs/MVP_PRD.md` — product definition and MVP scope.
- `docs/DSH_DEVELOPMENT_PLAN.md` — implementation architecture, phases, acceptance criteria and tests.
- `docs/RESEARCH_REFERENCES.md` — reference projects and what to borrow / not borrow.
- `GOAL_PROMPT.md` — long-running development prompt for DSH/Cursor/Codex-style agents.

## Working name

Repository: `dsh-grad-workbench`  
Product: **Graduate OS / 硕博工作台**

The name can change later without changing the product architecture.
