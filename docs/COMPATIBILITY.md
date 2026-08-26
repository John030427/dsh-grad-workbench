# DSH Compatibility — actual environment recon

Recorded from live inspection of THIS machine's installation (authoritative over any
community example). Re-verify after any DSH upgrade.

## Host

| Item | Value |
|---|---|
| DSH package | `@deepseek-ai/dsh` **0.1.1-rc.2** |
| Install kind | npm-installed via npx cache (no `vendor/`, no `packages/` source tree) |
| Checkout path | `C:\Users\Administrator\AppData\Local\npm-cache\_npx\1e7f6d9597241db0` |
| Node | v24.15.0 |
| Runtime SQLite | built-in `node:sqlite` (`DatabaseSync`), SQLite 3.51.3, **FTS5 + WAL verified** |
| OS | Windows (first-class target; no POSIX assumptions) |
| Live GUI | web profile at `http://127.0.0.1:3080` |

## Profile model

- Profiles live at `~/.dsh/profiles/<name>/`.
- A profile is a pnpm package dir: `package.json` declares
  `dsh.profile.bundles` (ordered bundle list) + `dependencies`
  (`link:`/`file:` for local plugins).
- Official `@deepseek-ai/*` bundles resolve from the npx checkout — the profile
  `node_modules` only needs the profile's OWN plugin deps (verified: the
  `mathmodel` profile has no hoisted `@deepseek-ai` scope).
- `dsh --profile <name>` boots any profile; `--port`, `--no-open` supported.
- ⚠️ `dsh plugin add` forwards to `pnpm add`; this machine's pnpm supply-chain
  gate (`minimumReleaseAge`) can fail the whole command. Use manual
  `node_modules` junctions instead.

## Host plugin contract (verified against working `@math-modeling/dsh-mathmodeling`)

- ESM module. `main` → host entry (`lib/index.js`). Exports map exposes
  `"./client"` → bundled client half.
- Host entry exports:
  - `export const inject = string[]` — cordis service names to wait for
    (e.g. `['webServer', 'skills', 'tools']`).
  - `export function apply(ctx)` — register features.
- Lifecycle: `ctx.effect(() => { …setup…; return disposeFn }, label)`.
- Web routes: `ctx.webServer.register({ kind: 'exact'|'prefix', path, handler(req,res) })`
  → returns disposer. Plain Node `http.IncomingMessage/ServerResponse`.
- Skills: `ctx.skills.register({ name, description, whenToUse, source: 'runtime',
  provider, content })` → returns unregister fn.
- Tools: `ctx.tools.register(definition)` → returns disposer. A definition is a
  plain object:
  - `name` — unique; `run_code` is reserved.
  - `description` — sent to the model.
  - `parameters` — raw JSON Schema object for arguments.
  - `output: { schema: JsonSchemaNode, render(args, value): ContentBlock[], presentationMeta? }`
    — mandatory canonical output contract; `render` must be a function;
    schema asserted via `assertSupportedJsonSchema` at register time.
  - `execute(args, exec): Promise<JsonValue>` — return value validated against
    `output.schema`.
  - Optional: `timeoutMs`, `isConcurrencySafe`, `finalizeContent`,
    `presentCall`, `presentResult`.
  - `defineTool` from `@deepseek-ai/dsh-tools` merely compiles a nicer schema
    DSL into this same shape — a plugin may construct the plain object directly,
    avoiding runtime imports of host packages entirely.
- ContentBlock: `{ type: 'text', text }` is the safe universal block.

## Client plugin contract (verified)

- Bundle output: CJS body wrapped as
  `window.__ModuleLoader__.load({ id, factory: (require) => { …cjs…; return module.exports } })`.
  `id` MUST equal the loader entry id from the bundle patch.
- Client entry exports `inject = ['slots','sessions']` and
  `apply(ctx: ClientContext)`.
- Slots used (official contracts):
  - `ctx.slots.inject('conversation.view', () => ctx.slots.register(
    { name:'conversation.view', id, order, label, inject: (sessionId) => props },
    Component))` — session tab (used as the single workbench surface).
  - `'sidebar.footer.action'` — one button in the native sidebar footer that
    switches the view (no second sidebar).
  - `'shell.overlay'` — fallback drawer.
- Session helpers via `ctx.sessions.binding(sessionId)?.session?.getSnapshot()`
  → `inputActions.setDraft(text)`, `actions.setView(id)`.
- Package manifest declares client needs:
  ```json
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "inject": ["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-ui-slots", "@deepseek-ai/dsh-client-ui-conversation"],
      "platform": "web"
    }
  }
  ```
- The host serves each plugin client at `/plugins/<entry-id>/client.js`
  (client-modules service scans entries declaring `dsh.client`).

## Bundle patch

- Package field `dsh.bundle.patch` points to a YAML file applied by the loader.
- Insert shape:
  ```yaml
  - insert:
      - id: dsh-grad-workbench
        name: dsh-grad-workbench
  ```
- `- id: <name> / disabled: true` blocks an entry (profile patch layering).

## Differences vs the plan's guesses

| Plan guessed | Actual | Decision |
|---|---|---|
| `defineTool` required for tools | plain-object definitions accepted; `register()` validates shape | construct plain objects, zero runtime imports of `@deepseek-ai/*` |
| vitest | machine convention is `node --test` against built `lib/` | use `node --test` (zero extra deps) |
| zod at boundaries | schemastery exists but adds coupling | small hand-written validators in `src/shared/validate.ts` |
| `~/.dsh/grad-workbench/` data root | confirmed writable convention (`~/.dsh/plugins/...` precedent) | use it, override with `GRAD_WORKBENCH_HOME` env for tests |
| separate `grad` profile via CLI add | CLI add can trip pnpm policy | create profile dir manually + junction |

## IM channel integration (dsh-im) — verified live

- `@xmanrui/dsh-im@2.1.0` runs in the WEB profile and bridges Feishu (+8 other
  channels) INBOUND into DSH agent sessions; replies stream back via the bot
  (Feishu interactive cards).
- Its host half exposes MANAGEMENT RPC only (`connection.status`,
  `provision.begin`, workspace/preset binding…) — no third-party
  "send to arbitrary chat" API. Verified from `plugin-src/host/channels/*`.
- Integration model therefore: install dsh-grad-workbench into the SAME
  profile as dsh-im (done on this machine via super-injector
  `dev_install_package`, loader entry `5ad9fc6b`, hot-loaded without restart).
  Feishu messages then reach an agent holding every `grad_*` tool, so
  Graduate OS is operable end-to-end from IM.
- Outbound proactive publishes stay approval-gated through the Connector layer
  (CLI transport when installed; im.send actions require explicit approval).
- Multi-process note: grad (3081) and web (3080) instances share
  `~/.dsh/grad-workbench/grad.db`; SQLite WAL + `busy_timeout=5000` covers
  normal concurrent use.

## Known risks

- DSH moves fast; re-run recon after upgrades (`docs/COMPATIBILITY.md` update +
  regression suite are part of the upgrade drill).
- Client slot names (`conversation.view`, `sidebar.footer.action`,
  `shell.overlay`) verified present in rc.2 UI packages; guarded with try/catch
  in the client so a future rename degrades gracefully instead of crashing boot.

## Service injection semantics (learned by crash, rc.2)

- cordis contexts are proxies: reading an undeclared service property throws
  `cannot get property "<name>" without inject`. There is no optional-access
  via `ctx.webServer`, and `ctx.reflect.get(name, false)` only sees the local
  fiber's store — it does NOT walk ancestor fibers, so it cannot be used for
  optional service lookup either.
- HOWEVER the proxy get-trap walks ancestor fiber STORES before consulting the
  inject map: a provided ancestor service is readable WITHOUT declaring it.
  Therefore `inject = ['tools']` plus a try/catch-guarded `ctx.webServer` read
  works on web profiles (provided upstream) and degrades cleanly on headless
  profiles (absent → throw → caught → no routes). Verified live on both.

## Tool definition semantics (learned by crash, rc.2)

- A registered ToolDefinition's `parameters` must be RAW JSON Schema (object
  root with properties/required), NOT the author-facing per-property spec map
  that `defineTool` takes — defineTool compiles spec→JSON Schema internally,
  but plain-object definitions skip that step. A spec-shaped `parameters`
  compiles to a permissive wire schema and the model sees NO arguments.
- Tool output values are enforced as LOSSLESS JSON: an explicit `undefined`
  property anywhere in the returned value fails dispatch with
  `INVALID_TOOL_OUTPUT "value is not lossless JSON"`. All grad tools pass their
  results through `toJsonLossless()` which strips undefined values deeply.
- Profile-layer patch rows (`~/.dsh/profiles/<p>/cordis.patch.yml`) did NOT
  override an inserted entry's `inject` reliably, and `disabled: true` rows can
  be undone when a later insert of the same package re-applies its own bundle
  patch.
- Working headless recipe: a tiny local bundle `dsh-webserver-shim`
  (`~/.dsh/dsh-webserver-shim`) that `ctx.provide('webServer', noop)`, listed
  in the headless profile's bundles BEFORE dsh-grad-workbench. The stock entry
  then activates everywhere; routes registered into the shim are discarded.
