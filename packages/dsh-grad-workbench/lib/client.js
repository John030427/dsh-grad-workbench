window.__ModuleLoader__.load({
  id: "@grad/dsh-grad-workbench",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    "use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react2 = require("react");

// src/client/app/GradWorkbench.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var API = "/api/grad";
async function get(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return await res.json();
}
async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok || data.ok === false) throw new Error(data.error ?? `${path}: ${res.status}`);
  return data;
}
var STYLE_ID = "dsh-grad-workbench-styles";
var CSS = `
.gwb-root { display:flex; flex-direction:column; height:100%; min-height:0; font-size:13px; color:inherit; }
.gwb-header { display:flex; align-items:center; gap:10px; padding:10px 14px; border-bottom:1px solid rgba(128,128,128,.22); flex:none; }
.gwb-title { font-weight:700; font-size:14px; }
.gwb-sub { opacity:.65; font-size:12px; }
.gwb-body { display:flex; flex:1 1 auto; min-height:0; }
.gwb-nav { width:168px; flex:none; border-right:1px solid rgba(128,128,128,.18); padding:8px 6px; display:flex; flex-direction:column; gap:2px; overflow-y:auto; }
.gwb-nav-item { text-align:left; border:0; background:transparent; color:inherit; cursor:pointer; padding:7px 10px; border-radius:8px; font-size:13px; }
.gwb-nav-item:hover { background:rgba(128,128,128,.15); }
.gwb-nav-item.active { background:rgba(99,140,255,.22); font-weight:600; }
.gwb-nav-item:disabled { opacity:.45; cursor:default; }
.gwb-content { flex:1 1 auto; overflow-y:auto; padding:16px 20px; min-width:0; }
.gwb-card { border:1px solid rgba(128,128,128,.22); border-radius:12px; padding:14px 16px; margin-bottom:12px; background:rgba(128,128,128,.05); }
.gwb-card h3 { margin:0 0 6px 0; font-size:13px; }
.gwb-card p { margin:4px 0; opacity:.85; }
.gwb-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:10px; }
.gwb-action { text-align:left; border:1px solid rgba(128,128,128,.25); background:transparent; color:inherit; border-radius:10px; padding:10px 12px; cursor:pointer; }
.gwb-action:hover:not(:disabled) { border-color:rgba(99,140,255,.6); }
.gwb-action:disabled { opacity:.45; cursor:default; }
.gwb-pill { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; border:1px solid rgba(128,128,128,.3); }
.gwb-ok { color:#4ade80; }
.gwb-bad { color:#f87171; }
.gwb-warn { color:#fbbf24; }
.gwb-muted { opacity:.55; }
.gwb-row { display:flex; align-items:center; gap:8px; padding:7px 0; border-bottom:1px dashed rgba(128,128,128,.15); flex-wrap:wrap; }
.gwb-row:last-child { border-bottom:0; }
.gwb-btn { border:1px solid rgba(128,128,128,.35); background:transparent; color:inherit; border-radius:8px; padding:4px 12px; cursor:pointer; font-size:12px; }
.gwb-btn.primary { border-color:#4ade80; color:#4ade80; }
.gwb-btn.danger { border-color:#f87171; color:#f87171; }
.gwb-btn:hover { filter:brightness(1.25); }
.gwb-input { width:100%; box-sizing:border-box; background:transparent; border:1px solid rgba(128,128,128,.3); color:inherit; border-radius:8px; padding:8px 10px; font-size:13px; resize:vertical; }
.gwb-mono { font-family:ui-monospace,Consolas,monospace; font-size:11px; word-break:break-all; }
`;
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
function StatusPill({ status }) {
  const cls = status === "completed" ? "gwb-ok" : status === "failed" ? "gwb-bad" : status === "waiting_approval" ? "gwb-warn" : "";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `gwb-pill ${cls}`, children: status });
}
var NAV = [
  { id: "home", label: "\u{1F3E0} Home", enabled: true },
  { id: "research", label: "\u{1F52C} Research", enabled: true },
  { id: "communication", label: "\u{1F4AC} Communication", enabled: true },
  { id: "life", label: "\u{1F35C} Life", enabled: true },
  { id: "automation", label: "\u2699\uFE0F Automation", enabled: true },
  { id: "memory", label: "\u{1F9E0} Memory", enabled: true },
  { id: "connections", label: "\u{1F517} Connections", enabled: true },
  { id: "settings", label: "\u{1F527} Settings", enabled: false }
];
var PLACEHOLDER = {
  settings: { title: "Settings", phase: 1, desc: "Workbench preferences, data location, memory write policy." }
};
function FoodSection() {
  const [items, setItems] = (0, import_react.useState)([]);
  const [name, setName] = (0, import_react.useState)("");
  const [note, setNote] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const load = (0, import_react.useCallback)(() => {
    void get("/food/restaurants").then((d) => setItems(d.restaurants)).catch(() => {
    });
  }, []);
  (0, import_react.useEffect)(() => {
    load();
  }, [load]);
  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await post("/food/restaurants", { name: name.trim(), ...note ? { note } : {} });
      setName("");
      setNote("");
      load();
    } finally {
      setBusy(false);
    }
  };
  const act = async (id, action, extra) => {
    setBusy(true);
    try {
      await post(`/food/restaurants/${id}/${action}`, extra ?? {});
      load();
    } finally {
      setBusy(false);
    }
  };
  const unresolved = items.filter((r) => r.status === "unresolved");
  const confirmed = items.filter((r) => r.status !== "unresolved");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Save a restaurant" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "gwb-muted", children: [
        "Captures stay ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "unresolved" }),
        " until you confirm the place \u2014 ambiguous locations are never auto-pinned."
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: "gwb-input", style: { flex: 1 }, placeholder: "Restaurant name\u2026", value: name, onChange: (e) => setName(e.target.value) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: "gwb-input", style: { flex: 1 }, placeholder: "Note (who recommended / why)", value: note, onChange: (e) => setNote(e.target.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: 8 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gwb-btn primary", disabled: busy || !name.trim(), onClick: add, children: "Add" }) })
    ] }),
    unresolved.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { children: [
        "Unresolved queue (",
        unresolved.length,
        ") \u2014 needs your confirmation"
      ] }),
      unresolved.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConfirmRow, { r, busy, onConfirm: act, onDelete: act }, r.id))
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { children: [
        "Confirmed pins (",
        confirmed.length,
        ")"
      ] }),
      confirmed.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gwb-muted", children: "Nothing pinned yet." }) : confirmed.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-pill", children: r.status }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flex: 1 }, children: r.name }),
        r.address ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-muted", children: r.address }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gwb-btn", disabled: busy, onClick: () => act(r.id, "status", { status: "visited" }), children: "Mark visited" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gwb-btn danger", disabled: busy, onClick: () => act(r.id, "delete"), children: "Delete" })
      ] }, r.id))
    ] })
  ] });
}
function ConfirmRow({ r, busy, onConfirm, onDelete }) {
  const [address, setAddress] = (0, import_react.useState)("");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-row", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-pill gwb-warn", children: r.status }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flex: 1 }, children: r.name }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "input",
      {
        className: "gwb-input",
        style: { width: 220 },
        placeholder: "Confirm address\u2026",
        value: address,
        onChange: (e) => setAddress(e.target.value)
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gwb-btn primary", disabled: busy || !address.trim(), onClick: () => onConfirm(r.id, "confirm", { address }), children: "Confirm pin" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gwb-btn danger", disabled: busy, onClick: () => onDelete(r.id, "delete"), children: "Delete" })
  ] });
}
function LedgerSection() {
  const [entries, setEntries] = (0, import_react.useState)([]);
  const [summary, setSummary] = (0, import_react.useState)(null);
  const [org, setOrg] = (0, import_react.useState)("");
  const [hours, setHours] = (0, import_react.useState)("3");
  const [note, setNote] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const load = (0, import_react.useCallback)(() => {
    void get("/ledger?category=volunteer").then((d) => {
      setEntries(d.entries);
      setSummary(d.summary);
    }).catch(() => {
    });
  }, []);
  (0, import_react.useEffect)(() => {
    load();
  }, [load]);
  const add = async () => {
    const h = Number(hours);
    if (!org.trim() || !Number.isFinite(h)) return;
    setBusy(true);
    try {
      const start = /* @__PURE__ */ new Date();
      await post("/ledger", {
        category: "volunteer",
        startAt: start.toISOString(),
        durationMinutes: Math.round(h * 60),
        organization: org.trim(),
        activityType: "volunteer",
        ...note ? { note } : {}
      });
      setNote("");
      load();
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Volunteer hours" }),
      summary ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
        "Total: ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: [
          Math.round(summary.totalMinutes / 60 * 10) / 10,
          " h"
        ] }),
        " across ",
        summary.count,
        " entries"
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: "gwb-input", style: { flex: 1 }, placeholder: "Organization / activity", value: org, onChange: (e) => setOrg(e.target.value) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: "gwb-input", style: { width: 90 }, value: hours, onChange: (e) => setHours(e.target.value) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-muted", style: { alignSelf: "center" }, children: "hours" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8, marginTop: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: "gwb-input", style: { flex: 1 }, placeholder: "Note (optional)", value: note, onChange: (e) => setNote(e.target.value) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gwb-btn primary", disabled: busy || !org.trim(), onClick: add, children: "Log hours" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { className: "gwb-btn", href: "/api/grad/ledger?category=volunteer&format=csv", children: "Export CSV" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Recent entries" }),
      entries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gwb-muted", children: "No entries yet." }) : null,
      entries.slice(0, 10).map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-pill", children: e.category }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flex: 1 }, children: e.organization ?? e.note ?? e.activityType }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-muted", children: new Date(e.startAt).toLocaleDateString() }),
        e.durationMinutes !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gwb-pill", children: [
          (e.durationMinutes / 60).toFixed(1),
          " h"
        ] }) : null
      ] }, e.id))
    ] })
  ] });
}
function LifePage() {
  const [tab, setTab] = (0, import_react.useState)("food");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gwb-card", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: `gwb-btn${tab === "food" ? " primary" : ""}`, onClick: () => setTab("food"), children: "Food Map" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: `gwb-btn${tab === "ledger" ? " primary" : ""}`, onClick: () => setTab("ledger"), children: "Ledger" })
    ] }) }),
    tab === "food" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FoodSection, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LedgerSection, {})
  ] });
}
function CommunicationPage() {
  const [originalText, setOriginalText] = (0, import_react.useState)("");
  const [myUpdate, setMyUpdate] = (0, import_react.useState)("");
  const [understanding, setUnderstanding] = (0, import_react.useState)(null);
  const [drafts, setDrafts] = (0, import_react.useState)([]);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)(null);
  const analyze = async () => {
    if (!originalText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const d = await post("/communication/understand", { text: originalText });
      setUnderstanding(d.understanding);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const draft = async () => {
    if (!originalText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const d = await post("/communication/draft", {
        originalText,
        ...myUpdate.trim() ? { myUpdate } : {}
      });
      setDrafts(d.drafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const copyDraft = (text) => {
    void navigator.clipboard?.writeText(text).catch(() => {
    });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Advisor message assistant" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gwb-muted", children: "\u7406\u89E3 \u2192 \u8D77\u8349\u3002\u8349\u7A3F\u4EC5\u4FDD\u5B58\u5728\u672C\u5730\uFF1B\u53D1\u9001\u6C38\u8FDC\u9700\u8981\u901A\u8FC7\u8FDE\u63A5\u5668\u7684\u5BA1\u6279\u6D41\u7A0B\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "textarea",
        {
          className: "gwb-input",
          rows: 4,
          placeholder: "Paste the advisor/teacher message here\u2026",
          value: originalText,
          onChange: (e) => setOriginalText(e.target.value)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: 8 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gwb-btn primary", disabled: busy || !originalText.trim(), onClick: analyze, children: "Understand" }) })
    ] }),
    understanding ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Understanding" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-pill", children: understanding.relationship }),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-pill", children: understanding.scenario }),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-pill", children: understanding.intent }),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: `gwb-pill ${understanding.risk === "high" ? "gwb-bad" : ""}`, children: [
          "risk: ",
          understanding.risk
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: understanding.coreDemand }),
      understanding.commitments.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: { marginTop: 10 }, children: "Commitments / deadlines detected" }),
        understanding.commitments.map((c, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
          "\u2022 ",
          c.what,
          " ",
          c.due ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gwb-warn", children: [
            "(due: ",
            c.due,
            ")"
          ] }) : null
        ] }, i))
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "textarea",
        {
          className: "gwb-input",
          style: { marginTop: 8 },
          rows: 2,
          placeholder: "\u4F60\u5B9E\u9645\u5B8C\u6210\u7684\u4E8B\u9879\uFF08\u8349\u7A3F\u53EA\u5F15\u7528\u4F60\u63D0\u4F9B\u7684\u4E8B\u5B9E\uFF0C\u7EDD\u4E0D\u7F16\u9020\u8FDB\u5EA6\uFF09",
          value: myUpdate,
          onChange: (e) => setMyUpdate(e.target.value)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: 8 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gwb-btn primary", disabled: busy, onClick: draft, children: "Draft replies" }) })
    ] }) : null,
    drafts.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { children: [
        "Draft \u2014 ",
        d.tone,
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gwb-btn", style: { float: "right" }, onClick: () => copyDraft(d.markdown), children: "Copy" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { className: "gwb-mono", style: { whiteSpace: "pre-wrap" }, children: d.markdown })
    ] }, d.tone)),
    error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gwb-card", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gwb-bad", children: error }) }) : null
  ] });
}
function ConnectionsPage() {
  const [connectors, setConnectors] = (0, import_react.useState)([]);
  (0, import_react.useEffect)(() => {
    void get("/connectors").then((d) => setConnectors(d.connectors)).catch(() => {
    });
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Connections" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gwb-muted", children: "External systems are reachable only through connectors. Every publish/send/submit action requires explicit approval and is recorded with its approval id." })
    ] }),
    connectors.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { children: [
        c.label,
        " ",
        c.healthy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-pill gwb-ok", children: "ready" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-pill gwb-warn", children: "needs setup" })
      ] }),
      c.reason ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gwb-warn", children: c.reason }) : null,
      c.notes ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gwb-muted", children: c.notes }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: c.actions.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-pill", style: { marginRight: 6 }, children: a }, a)) })
    ] }, c.id))
  ] });
}
function ResearchPage() {
  const [topic, setTopic] = (0, import_react.useState)("LLM agent memory");
  const [count, setCount] = (0, import_react.useState)(50);
  const [since, setSince] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)(null);
  const [papers, setPapers] = (0, import_react.useState)([]);
  const [collectionId, setCollectionId] = (0, import_react.useState)(null);
  const [note, setNote] = (0, import_react.useState)(null);
  const [complete, setComplete] = (0, import_react.useState)(null);
  const [report, setReport] = (0, import_react.useState)(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    setPapers([]);
    setReport(null);
    setCollectionId(null);
    try {
      const data = await post(
        "/research/collections",
        { topic: topic.trim(), count, ...since ? { since } : {} }
      );
      setPapers(data.papers ?? []);
      setCollectionId(data.collectionId);
      setComplete(data.complete);
      setNote(data.note ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const synthesizeNow = async () => {
    if (!collectionId) return;
    setBusy(true);
    try {
      const r = await post(`/research/collections/${collectionId}/synthesize`, {});
      const art = await get(`/artifacts/${r.artifactId}`);
      setReport(art.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Latest Literature Radar" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gwb-muted", children: "OpenAlex discovery \u2192 S2 enrichment \u2192 DOI/OA/S2 dedup \u2192 relevance+recency rank. Evidence-tagged deterministic report." }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: "gwb-input", style: { flex: 2, minWidth: 200 }, value: topic, onChange: (e) => setTopic(e.target.value), placeholder: "Topic" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: "gwb-input", style: { flex: 0, width: 80 }, type: "number", min: 5, max: 200, value: count, onChange: (e) => setCount(Number(e.target.value)) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: "gwb-input", style: { flex: 0, width: 110 }, value: since, onChange: (e) => setSince(e.target.value), placeholder: "since (year)" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gwb-btn primary", disabled: busy || !topic.trim(), onClick: run, children: busy ? "Collecting\u2026" : "Collect" })
      ] }),
      error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gwb-bad", children: error }) : null,
      note ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gwb-warn", children: note }) : null,
      complete === false && papers.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gwb-warn", children: "Partial corpus \u2014 provider limits. Results shown honestly, nothing fabricated." }) : null
    ] }),
    papers.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { children: [
        "Papers (",
        papers.length,
        ")"
      ] }),
      papers.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-pill", children: p.evidenceLevel === "metadata" ? "[M]" : "[A]" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flex: 1 }, children: p.title }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-muted", children: p.year ?? "" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-muted", children: p.citationCount !== void 0 ? `${p.citationCount} cites` : "" })
      ] }, p.id)),
      collectionId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: 10 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gwb-btn primary", disabled: busy, onClick: synthesizeNow, children: "Generate cited report" }) }) : null
    ] }) : null,
    report ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Report preview" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { className: "gwb-mono", style: { whiteSpace: "pre-wrap" }, children: report.slice(0, 4e3) })
    ] }) : null
  ] });
}
function MemoryPage() {
  const [items, setItems] = (0, import_react.useState)([]);
  const [query, setQuery] = (0, import_react.useState)("");
  const [draft, setDraft] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const load = (0, import_react.useCallback)(() => {
    const path = query.trim() ? `/memory?q=${encodeURIComponent(query.trim())}` : "/memory";
    void get(path).then((d) => {
      setItems(d.items ?? d.results ?? []);
    }).catch(() => {
    });
  }, [query]);
  (0, import_react.useEffect)(() => {
    load();
  }, [load]);
  const add = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await post("/memory", { content: draft.trim() });
      setDraft("");
      load();
    } finally {
      setBusy(false);
    }
  };
  const act = async (id, action) => {
    setBusy(true);
    try {
      await post(`/memory/${id}/${action}`, {});
      load();
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Memory Center" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gwb-muted", children: "Local-first, scoped, source-attributed. Candidates (unconfirmed proposals) need your confirmation before they become first-class." }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          className: "gwb-input",
          placeholder: "Search memory\u2026",
          value: query,
          onChange: (e) => setQuery(e.target.value)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8, marginTop: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            className: "gwb-input",
            style: { flex: 1 },
            placeholder: "Remember something new\u2026",
            value: draft,
            onChange: (e) => setDraft(e.target.value)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gwb-btn primary", disabled: busy || !draft.trim(), onClick: add, children: "Add" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gwb-card", children: items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gwb-muted", children: query ? `No matches for "${query}".` : "Memory is empty." }) : items.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-pill", children: m.kind }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-pill gwb-muted", children: m.scopeType }),
      !m.userConfirmed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-pill gwb-warn", children: "candidate" }) : null,
      m.pinned ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-pill", children: "\u{1F4CC}" }) : null,
      m.outdated ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-pill gwb-muted", children: "outdated" }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flex: 1 }, children: m.content }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gwb-btn", disabled: busy, onClick: () => act(m.id, "pin"), children: m.pinned ? "Unpin" : "Pin" }),
      !m.userConfirmed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gwb-btn primary", disabled: busy, onClick: () => act(m.id, "confirm"), children: "Confirm" }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gwb-btn danger", disabled: busy, onClick: () => act(m.id, "delete"), children: "Delete" })
    ] }, m.id)) })
  ] });
}
function PendingApprovalsCard({ approvals, onChanged }) {
  const [busy, setBusy] = (0, import_react.useState)(false);
  if (approvals.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Pending approvals" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gwb-muted", children: "No external actions waiting. Side effects always require explicit approval here." })
    ] });
  }
  const resolve = async (id, decision) => {
    setBusy(true);
    try {
      await post(`/approvals/${id}/resolve`, { decision });
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { children: [
      "Pending approvals (",
      approvals.length,
      ")"
    ] }),
    approvals.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { status: a.actionType }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flex: 1 }, children: a.summary }),
      a.destination ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gwb-muted", children: [
        "\u2192 ",
        a.destination
      ] }) : null,
      a.workflowRunId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-mono gwb-muted", children: a.workflowRunId.slice(0, 8) }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gwb-btn danger", disabled: busy, onClick: () => resolve(a.id, "rejected"), children: "Reject" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gwb-btn primary", disabled: busy, onClick: () => resolve(a.id, "approved"), children: "Approve once" })
    ] }, a.id))
  ] });
}
function HomePage({
  health,
  runs,
  approvals,
  captures,
  onChanged
}) {
  const [draft, setDraft] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const capture = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await post("/captures", { text: draft.trim() });
      setDraft("");
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const runEchoDemo = async () => {
    setBusy(true);
    try {
      await post("/workflows/echo-demo/run", { input: { message: `Home quick action ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}` } });
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Universal capture" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "textarea",
        {
          className: "gwb-input",
          rows: 2,
          placeholder: "Paste a sentence, a teacher message, a paper topic\u2026",
          value: draft,
          onChange: (e) => setDraft(e.target.value)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: 8 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gwb-btn primary", disabled: busy || !draft.trim(), onClick: capture, children: "Capture \u2192 route" }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PendingApprovalsCard, { approvals, onChanged }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Recent workflow runs" }),
      runs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "gwb-muted", children: [
        "No runs yet.",
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gwb-btn", disabled: busy, onClick: runEchoDemo, children: "Run echo-demo" }),
        " ",
        "to see the approval flow."
      ] }) : runs.slice(0, 8).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { status: r.status }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: r.workflowId }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-muted", children: new Date(r.startedAt).toLocaleString() }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-mono gwb-muted", style: { marginLeft: "auto" }, children: r.id.slice(0, 8) }),
        r.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-bad", children: r.error }) : null
      ] }, r.id))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Latest captures" }),
      captures.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gwb-muted", children: "Nothing captured yet." }) : captures.slice(0, 6).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { status: c.status }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: c.text }),
        c.inferredIntent ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-pill", children: c.inferredIntent }) : null
      ] }, c.id))
    ] }),
    health?.dataDir ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Data" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "gwb-muted gwb-mono", children: [
        "local-first root: ",
        health.dataDir
      ] })
    ] }) : null
  ] });
}
function AutomationPage({ runs }) {
  const [skills, setSkills] = (0, import_react.useState)([]);
  const [recipes, setRecipes] = (0, import_react.useState)([]);
  const [stepIds, setStepIds] = (0, import_react.useState)([]);
  (0, import_react.useEffect)(() => {
    void get("/skills").then((d) => {
      setSkills(d.skills);
      setRecipes(d.recipes);
    }).catch(() => {
    });
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Run history" }),
      runs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gwb-muted", children: "No runs recorded yet." }) : runs.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { status: r.status }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-mono", children: r.id.slice(0, 8) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: r.workflowId }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-muted", children: new Date(r.startedAt).toLocaleString() }),
        r.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-bad", children: r.error }) : null
      ] }, r.id))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Skill Studio \u2014 atomic skills" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gwb-muted", children: stepIds.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        "Selected chain: ",
        stepIds.join(" \u2192 "),
        " (compose via grad_skill_compose_recipe)"
      ] }) : "Pick skills to see a chain preview; compose via the grad_skill_compose_recipe tool." }),
      skills.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-pill", children: s.externalSideEffect ? "side-effect" : "local" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flex: 1 }, children: s.title }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gwb-muted gwb-mono", children: [
          "in: [",
          s.requiredInputs.join(","),
          "] out: [",
          s.outputs.join(","),
          "]"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            className: "gwb-btn",
            onClick: () => setStepIds((prev) => [...prev, s.id]),
            children: "+ chain"
          }
        )
      ] }, s.id)),
      stepIds.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gwb-btn", onClick: () => setStepIds([]), children: "Clear chain" }) : null,
      recipes.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: { marginTop: 10 }, children: "Composed recipes" }),
        recipes.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-mono", children: r.recipeId }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: r.title }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-muted", style: { flex: 1 }, children: r.steps })
        ] }, r.recipeId))
      ] }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlaceholderPage, { page: { title: "Form Assistant UI", phase: 8, desc: "Inspect forms and propose values with sources via the grad_form_* tools; fill/submit run behind two separate approvals." } })
  ] });
}
function PlaceholderPage({ page }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-card", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: page.title }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: page.desc }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "gwb-muted", children: [
      "Planned for phase ",
      page.phase,
      " of docs/DSH_DEVELOPMENT_PLAN.md."
    ] })
  ] });
}
function GradWorkbench() {
  const [page, setPage] = (0, import_react.useState)("home");
  const [health, setHealth] = (0, import_react.useState)(null);
  const [runs, setRuns] = (0, import_react.useState)([]);
  const [approvals, setApprovals] = (0, import_react.useState)([]);
  const [captures, setCaptures] = (0, import_react.useState)([]);
  const refresh = (0, import_react.useCallback)(() => {
    void get("/health").then(setHealth).catch(() => setHealth(null));
    void get("/runs").then((d) => setRuns(d.runs)).catch(() => {
    });
    void get("/approvals?status=pending").then((d) => setApprovals(d.approvals)).catch(() => {
    });
    void get("/captures").then((d) => setCaptures(d.captures)).catch(() => {
    });
  }, []);
  (0, import_react.useEffect)(() => {
    ensureStyles();
    refresh();
    const timer = setInterval(refresh, 5e3);
    return () => clearInterval(timer);
  }, [refresh]);
  const placeholder = PLACEHOLDER[page];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-root", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-title", children: "\u{1F393} \u7855\u535A\u5DE5\u4F5C\u53F0 \xB7 Graduate OS" }),
      health ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gwb-sub", children: [
        "v",
        health.version
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gwb-sub gwb-bad", children: "host offline" }),
      approvals.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gwb-pill gwb-warn", children: [
        approvals.length,
        " approval(s) waiting"
      ] }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gwb-body", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", { className: "gwb-nav", children: NAV.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          disabled: !item.enabled,
          title: item.enabled ? void 0 : "Arrives with its vertical slice",
          className: `gwb-nav-item${page === item.id ? " active" : ""}`,
          onClick: () => setPage(item.id),
          children: item.label
        },
        item.id
      )) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", { className: "gwb-content", children: page === "home" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HomePage, { health, runs, approvals, captures, onChanged: refresh }) : page === "research" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResearchPage, {}) : page === "automation" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AutomationPage, { runs }) : page === "memory" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MemoryPage, {}) : page === "connections" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConnectionsPage, {}) : page === "communication" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommunicationPage, {}) : page === "life" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LifePage, {}) : placeholder ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlaceholderPage, { page: placeholder }) : null })
    ] })
  ] });
}

// src/client/index.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var VIEW_ID = "grad-workbench";
var OVERLAY_EVENT = "dsh-grad-workbench:overlay";
function isShellHost() {
  try {
    return window.__GRAD_SHELL_HOST__ === true;
  } catch {
    return false;
  }
}
function getSessionHelpers(ctx, sessionId) {
  if (!sessionId) return {};
  try {
    const binding = ctx.sessions.binding(sessionId);
    const session = binding?.session;
    return {
      sessionId,
      setDraft: (text) => {
        try {
          const store = session?.getSnapshot?.();
          store?.inputActions?.setDraft?.(text);
        } catch {
        }
      },
      setView: (viewId) => {
        try {
          const store = session?.getSnapshot?.();
          store?.actions?.setView?.(viewId);
        } catch {
        }
      }
    };
  } catch {
    return {};
  }
}
function WorkbenchFooter({ wide, setView, openOverlay }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "button",
    {
      type: "button",
      title: "\u7855\u535A\u5DE5\u4F5C\u53F0\uFF08\u4F1A\u8BDD\u6807\u7B7E\uFF09",
      onClick: () => {
        if (setView) setView(VIEW_ID);
        else openOverlay?.();
      },
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: wide ? "flex-start" : "center",
        gap: 6,
        width: "100%",
        border: 0,
        background: "transparent",
        color: "inherit",
        cursor: "pointer",
        padding: "8px 10px"
      },
      children: wide ? "\u{1F393} \u7855\u535A\u5DE5\u4F5C\u53F0" : "\u{1F393}"
    }
  );
}
function OverlayHost() {
  const [open, setOpen] = (0, import_react2.useState)(false);
  (0, import_react2.useEffect)(() => {
    const onOpen = () => setOpen(true);
    document.addEventListener(OVERLAY_EVENT, onOpen);
    return () => document.removeEventListener(OVERLAY_EVENT, onOpen);
  }, []);
  if (!open) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_jsx_runtime2.Fragment, {});
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "div",
    {
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 99990,
        display: "flex",
        justifyContent: "flex-end",
        background: "rgba(0,0,0,0.35)",
        pointerEvents: "auto"
      },
      onClick: () => setOpen(false),
      children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "div",
        {
          style: {
            width: "min(960px, 96vw)",
            height: "100%",
            background: "var(--dsh-bg, #1a1a1a)",
            color: "inherit",
            boxShadow: "-8px 0 32px rgba(0,0,0,0.35)"
          },
          onClick: (e) => e.stopPropagation(),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { padding: "12px 16px", borderBottom: "1px solid rgba(128,128,128,0.25)" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: "\u7855\u535A\u5DE5\u4F5C\u53F0" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", style: { float: "right" }, onClick: () => setOpen(false), children: "\u5173\u95ED" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(GradWorkbench, {})
          ]
        }
      )
    }
  );
}
var inject = ["slots", "sessions"];
function apply(ctx) {
  if (isShellHost()) {
    return;
  }
  try {
    ctx.slots.inject(
      "conversation.view",
      () => ctx.slots.register(
        {
          name: "conversation.view",
          id: VIEW_ID,
          order: 55,
          label: () => "\u7855\u535A\u5DE5\u4F5C\u53F0",
          inject: (sessionId) => getSessionHelpers(ctx, sessionId)
        },
        () => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(GradWorkbench, {})
      )
    );
  } catch {
  }
  try {
    ctx.slots.inject(
      "sidebar.footer.action",
      () => ctx.slots.register(
        {
          name: "sidebar.footer.action",
          id: "dsh-grad-workbench-footer",
          order: 105,
          inject: () => {
            const current = ctx.sessions.list.getSnapshot?.()?.current;
            const helpers = getSessionHelpers(ctx, current);
            return {
              wide: true,
              setView: helpers.setView,
              openOverlay: () => document.dispatchEvent(new CustomEvent(OVERLAY_EVENT))
            };
          }
        },
        WorkbenchFooter
      )
    );
  } catch {
  }
  try {
    ctx.slots.inject(
      "shell.overlay",
      () => ctx.slots.register(
        {
          name: "shell.overlay",
          id: "dsh-grad-workbench-overlay",
          order: 110,
          inject: () => ({})
        },
        OverlayHost
      )
    );
  } catch {
  }
}

    return module.exports;
  }
});
