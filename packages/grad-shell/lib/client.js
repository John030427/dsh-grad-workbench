window.__ModuleLoader__.load({
  id: "@grad/grad-shell",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
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
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
if (typeof window !== "undefined") {
  window.__GRAD_SHELL_HOST__ = true;
  document.documentElement.dataset.gradShellHost = "1";
}
var API = "/api/grad";
var NAV_KEY = "grad-shell.section";
var NAV = [
  { group: "\u6982\u89C8", items: [{ id: "dashboard", label: "Dashboard", icon: "\u{1F3E0}" }] },
  { group: "\u7814\u7A76", items: [{ id: "research", label: "\u6587\u732E\u96F7\u8FBE", icon: "\u{1F52C}" }] },
  { group: "\u6C9F\u901A", items: [{ id: "communication", label: "\u5BFC\u5E08\u6C9F\u901A", icon: "\u{1F4AC}" }] },
  { group: "\u751F\u6D3B", items: [{ id: "life", label: "\u7F8E\u98DF / \u53F0\u8D26", icon: "\u{1F35C}" }] },
  { group: "\u81EA\u52A8\u5316", items: [{ id: "automation", label: "\u5DE5\u4F5C\u6D41 / \u6280\u80FD", icon: "\u2699\uFE0F" }] },
  { group: "\u57FA\u7840", items: [{ id: "memory", label: "\u8BB0\u5FC6\u4E2D\u5FC3", icon: "\u{1F9E0}" }, { id: "connections", label: "\u8FDE\u63A5", icon: "\u{1F517}" }] }
];
var ALL_ITEMS = NAV.flatMap((g) => g.items);
var SECTION_META = {
  dashboard: { title: "Dashboard", sub: "\u4ECA\u5929\u6700\u503C\u5F97\u7EE7\u7EED\u4EC0\u4E48\uFF1F" },
  research: { title: "\u6587\u732E\u96F7\u8FBE", sub: "Latest-50 \u8BBA\u6587 \xB7 \u53BB\u91CD \xB7 \u8BC1\u636E\u6807\u6CE8\u62A5\u544A \xB7 \u98DE\u4E66\u53D1\u5E03\uFF08\u5BA1\u6279\uFF09" },
  communication: { title: "\u5BFC\u5E08\u6C9F\u901A", sub: "\u6D88\u606F\u7406\u89E3 \xB7 \u591A\u8BED\u6C14\u8349\u7A3F \xB7 \u4E0D\u865A\u6784\u8FDB\u5EA6" },
  life: { title: "\u751F\u6D3B", sub: "\u98DF\u7269\u5730\u56FE \xB7 \u5FD7\u613F\u53F0\u8D26 \xB7 \u5065\u8EAB\u8BAD\u7EC3" },
  automation: { title: "\u81EA\u52A8\u5316", sub: "\u5DE5\u4F5C\u6D41\u8FD0\u884C\u5386\u53F2 \xB7 \u6280\u80FD\u914D\u65B9 \xB7 \u8868\u5355\u52A9\u624B" },
  memory: { title: "\u8BB0\u5FC6\u4E2D\u5FC3", sub: "\u672C\u5730\u4F18\u5148 \xB7 \u53EF\u68C0\u67E5 \xB7 \u6EAF\u6E90\u6807\u6CE8" },
  connections: { title: "\u8FDE\u63A5", sub: "\u98DE\u4E66\u4F18\u5148 \xB7 \u5BA1\u6279\u95E8\u63A7 \xB7 \u80FD\u529B\u53D1\u73B0" }
};
function parseRgb(color) {
  const m = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  const hex = color.replace("#", "");
  if (hex.length >= 6) return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  return [255, 255, 255];
}
var lum = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
var rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;
function derivePalette() {
  const cs = getComputedStyle(document.body);
  const bg = cs.backgroundColor || "rgb(255,255,255)";
  const fg = cs.color || "rgb(15,17,21)";
  const bgC = parseRgb(bg);
  const fgC = parseRgb(fg);
  const light = lum(bgC) > 0.5;
  return {
    bg,
    fg,
    border: rgba(fgC, light ? 0.14 : 0.16),
    cardBg: light ? "rgba(255,255,255,0.85)" : rgba(fgC, 0.05),
    muted: rgba(fgC, 0.58),
    accent: light ? "#3f66f0" : "#7c9cff",
    accentSoft: rgba(light ? [63, 102, 240] : [124, 156, 255], 0.14),
    danger: "#cc4b4b",
    warn: "#c77c1d",
    ok: "#2e9e5b"
  };
}
function useThemePalette() {
  const [pal, setPal] = (0, import_react.useState)(derivePalette);
  (0, import_react.useEffect)(() => {
    const obs = new MutationObserver(() => setPal(derivePalette()));
    obs.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    return () => obs.disconnect();
  }, []);
  return pal;
}
async function jget(url) {
  const r = await fetch(url);
  return r.json();
}
function Card(props) {
  const { pal } = props;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      onClick: props.onClick,
      style: {
        border: `1px solid ${pal.border}`,
        borderRadius: 10,
        background: pal.cardBg,
        padding: "12px 14px",
        ...props.onClick ? { cursor: "pointer" } : {},
        ...props.style
      },
      onMouseEnter: (e) => props.onClick && (e.currentTarget.style.borderColor = pal.accent),
      onMouseLeave: (e) => props.onClick && (e.currentTarget.style.borderColor = pal.border),
      children: props.children
    }
  );
}
function Btn(props) {
  const { pal } = props;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      type: "button",
      disabled: props.disabled,
      onClick: props.onClick,
      style: {
        padding: "6px 14px",
        fontSize: 12.5,
        borderRadius: 8,
        cursor: props.disabled ? "default" : "pointer",
        border: `1px solid ${props.primary ? pal.accent : pal.border}`,
        background: props.primary ? pal.accent : "transparent",
        color: props.primary ? "#fff" : pal.fg,
        opacity: props.disabled ? 0.5 : 1
      },
      children: props.children
    }
  );
}
var inputStyle = (pal) => ({
  width: "100%",
  padding: "7px 10px",
  fontSize: 12.5,
  borderRadius: 8,
  border: `1px solid ${pal.border}`,
  background: "transparent",
  color: pal.fg,
  outline: "none",
  boxSizing: "border-box"
});
function HealthLine({ pal }) {
  const [h, setH] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => {
    jget(`${API}/health`).then((d) => setH(d));
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { fontSize: 12, color: pal.muted, margin: "4px 0" }, children: h ? `host v${h.version} \xB7 workflows: ${(h.workflows ?? []).map((w) => w.id).join(", ")}` : "host offline" });
}
function Dashboard({ pal, onNavigate }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "22px 26px", overflow: "auto", height: "100%" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { style: { fontSize: 18, margin: "0 0 4px" }, children: "\u4ECA\u5929\u6700\u503C\u5F97\u7EE7\u7EED\u4EC0\u4E48\uFF1F" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { fontSize: 12.5, color: pal.muted, margin: "0 0 18px" }, children: "\u6355\u83B7 \u2192 \u8DEF\u7531 \u2192 \u5DE5\u4F5C\u6D41 \u2192 \u5DE5\u4EF6 \u2192 \u5BA1\u6279 \u2192 \u8FDE\u63A5\u5668" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }, children: [
      { title: "\u6587\u732E\u96F7\u8FBE", desc: "\u6700\u65B0 50 \u7BC7 \xB7 \u8BC1\u636E\u6807\u6CE8\u62A5\u544A", target: "research", cta: "\u5F00\u59CB\u68C0\u7D22" },
      { title: "\u5BFC\u5E08\u6C9F\u901A", desc: "\u7406\u89E3\u6D88\u606F \xB7 \u8D77\u8349\u56DE\u590D", target: "communication", cta: "\u8349\u62DF\u56DE\u590D" },
      { title: "\u751F\u6D3B\u53F0\u8D26", desc: "\u5FD7\u613F\u65F6\u957F \xB7 \u5065\u8EAB \xB7 \u7F8E\u98DF\u5730\u56FE", target: "life", cta: "\u8BB0\u5F55\u4E00\u7B14" }
    ].map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { pal: true, onClick: () => onNavigate(c.target), style: { padding: "16px 18px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 14, fontWeight: 700 }, children: c.title }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, color: pal.muted, marginTop: 5 }, children: c.desc }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 12, color: pal.accent, marginTop: 10, fontWeight: 600 }, children: [
        c.cta,
        " \u2192"
      ] })
    ] }, c.title)) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 13, fontWeight: 700, marginTop: 24, marginBottom: 10 }, children: "\u6A21\u5757\u5165\u53E3" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }, children: [
      { title: "\u6587\u732E\u96F7\u8FBE", desc: "Latest-50 \u8BBA\u6587", target: "research", icon: "\u{1F52C}" },
      { title: "\u5BFC\u5E08\u6C9F\u901A", desc: "\u7406\u89E3 + \u8349\u7A3F", target: "communication", icon: "\u{1F4AC}" },
      { title: "\u751F\u6D3B", desc: "\u7F8E\u98DF / \u53F0\u8D26", target: "life", icon: "\u{1F35C}" },
      { title: "\u81EA\u52A8\u5316", desc: "\u5DE5\u4F5C\u6D41 / \u6280\u80FD", target: "automation", icon: "\u2699\uFE0F" },
      { title: "\u8BB0\u5FC6\u4E2D\u5FC3", desc: "\u6EAF\u6E90\u8BB0\u5FC6", target: "memory", icon: "\u{1F9E0}" },
      { title: "\u8FDE\u63A5", desc: "\u98DE\u4E66\u5BA1\u6279", target: "connections", icon: "\u{1F517}" }
    ].map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { pal: true, onClick: () => onNavigate(m.target), style: { padding: "12px 14px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 18 }, children: m.icon }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 13, fontWeight: 600, marginTop: 6 }, children: m.title }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 11, color: pal.muted, marginTop: 3 }, children: m.desc })
    ] }, m.title)) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { pal: true, style: { marginTop: 20, padding: "14px 18px" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HealthLine, { pal }) })
  ] });
}
function ResearchSection({ pal }) {
  const [state, setState] = (0, import_react.useState)({ topic: "" });
  const run = async () => {
    const topic = state.topic.trim();
    if (!topic) return;
    setState({ ...state, busy: true, note: void 0 });
    try {
      const r = await fetch(`${API}/research/collections`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, count: 10 })
      });
      const d = await r.json();
      setState({ ...state, papers: d.papers ?? [], note: d.note, busy: false });
    } catch {
      setState({ ...state, busy: false, note: "\u68C0\u7D22\u5931\u8D25\uFF08\u63D0\u4F9B\u65B9\u9650\u6D41\u6216\u4E0D\u53EF\u7528\uFF09" });
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "18px 22px", height: "100%", overflow: "auto" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8, marginBottom: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          style: inputStyle(pal),
          placeholder: "\u7814\u7A76\u4E3B\u9898\uFF0C\u5982 LLM agent memory",
          value: state.topic,
          onChange: (e) => setState({ ...state, topic: e.target.value })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, { pal: true, primary: true, disabled: state.busy, onClick: run, children: state.busy ? "\u68C0\u7D22\u4E2D\u2026" : "\u6536\u96C6 10 \u7BC7" })
    ] }),
    state.note ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { fontSize: 12, color: pal.warn, margin: "6px 0" }, children: state.note }) : null,
    (state.papers ?? []).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { pal: true, style: { marginBottom: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 11, padding: "2px 8px", borderRadius: 999, background: pal.accentSoft, color: pal.accent }, children: p.evidenceLevel === "metadata" ? "[M]" : "[A]" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { style: { fontSize: 13, flex: 1 }, children: p.title }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 11, color: pal.muted }, children: p.year ?? "" })
      ] }),
      p.doi ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 11, color: pal.muted, marginTop: 4, wordBreak: "break-all" }, children: [
        "https://doi.org/",
        p.doi
      ] }) : null
    ] }, p.title))
  ] });
}
function SectionPlaceholder({ title, desc, pal }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { padding: "18px 22px", height: "100%", overflow: "auto" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { pal: true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 14, fontWeight: 700 }, children: title }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12.5, color: pal.muted, marginTop: 6 }, children: desc })
  ] }) });
}
function ShellFrame({ renderSlot }) {
  const pal = useThemePalette();
  const [active, setActiveState] = (0, import_react.useState)(loadSection);
  const [narrow, setNarrow] = (0, import_react.useState)(() => typeof window !== "undefined" && window.innerWidth <= 1180);
  const [agentOpen, setAgentOpen] = (0, import_react.useState)(true);
  (0, import_react.useEffect)(() => {
    const onResize = () => setNarrow(window.innerWidth <= 1180);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const navigate = (s) => {
    setActiveState(s);
    try {
      sessionStorage.setItem(NAV_KEY, s);
    } catch {
    }
  };
  const S = styles(pal);
  const agentStyle = narrow ? {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    width: "min(400px, 92vw)",
    zIndex: 70,
    background: pal.bg,
    display: agentOpen ? "flex" : "none",
    flexDirection: "column",
    boxShadow: "-8px 0 28px rgba(0,0,0,0.22)"
  } : { ...S.chatCol, display: "flex" };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { "data-grad-shell": "v1", style: S.frame, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", { style: S.nav, "data-grad-nav": "single", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.brand, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.brandTitle, children: "\u{1F393} Graduate OS" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.brandSub, children: "task-first \xB7 memory-aware \xB7 approval-gated" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", { style: S.navList, "data-grad-navlist": true, children: NAV.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.navGroup, children: g.group }),
        g.items.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            style: S.navItem(active === n.id),
            onClick: () => navigate(n.id),
            role: "tab",
            "aria-selected": active === n.id,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 14 }, children: n.icon }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: n.label })
            ]
          },
          n.id
        ))
      ] }, g.group)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { style: S.main, "data-grad-main": true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.mainHeader, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: S.mainTitle, "data-grad-title": true, children: SECTION_META[active].title }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: S.mainSub, children: SECTION_META[active].sub })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.mainBody, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.pane, "data-grad-section": active, children: [
        active === "dashboard" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dashboard, { pal, onNavigate: navigate }),
        active === "research" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResearchSection, { pal }),
        active === "communication" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionPlaceholder, { pal, title: "\u5BFC\u5E08\u6C9F\u901A", desc: "\u6D88\u606F\u7406\u89E3\u4E0E\u591A\u8BED\u6C14\u8349\u7A3F \u2014\u2014 \u901A\u8FC7 /api/grad/communication \u63A5\u5165\u3002" }),
        active === "life" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionPlaceholder, { pal, title: "\u751F\u6D3B", desc: "\u98DF\u7269\u5730\u56FE \xB7 \u5FD7\u613F\u53F0\u8D26 \xB7 \u5065\u8EAB\u8BAD\u7EC3 \u2014\u2014 \u6570\u636E\u4E0E API \u5DF2\u5C31\u7EEA\u3002" }),
        active === "automation" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionPlaceholder, { pal, title: "\u81EA\u52A8\u5316", desc: "\u5DE5\u4F5C\u6D41\u8FD0\u884C\u5386\u53F2 \xB7 \u6280\u80FD\u914D\u65B9 \u2014\u2014 \u901A\u8FC7 grad_run_workflow / grad_skill_* \u9A71\u52A8\u3002" }),
        active === "memory" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionPlaceholder, { pal, title: "\u8BB0\u5FC6\u4E2D\u5FC3", desc: "\u672C\u5730\u4F18\u5148\u8BB0\u5FC6\uFF1AFTS \u68C0\u7D22 \xB7 \u5019\u9009\u786E\u8BA4 \xB7 \u654F\u611F\u6027\u63A7\u5236\u3002" }),
        active === "connections" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionPlaceholder, { pal, title: "\u8FDE\u63A5", desc: "\u98DE\u4E66\u8FDE\u63A5\u5668\uFF08\u5BA1\u6279\u95E8\u63A7\uFF09 \xB7 \u80FD\u529B\u53D1\u73B0 \xB7 \u5065\u5EB7\u68C0\u67E5\u3002" })
      ] }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { style: agentStyle, "data-grad-agent": true, "data-grad-agent-open": agentOpen ? "1" : "0", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.chatHeader, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 12.5, fontWeight: 700 }, children: "Agent" }),
        narrow && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            onClick: () => setAgentOpen(false),
            style: { border: "none", background: "none", color: pal.fg, cursor: "pointer", fontSize: 12 },
            children: "\u2715"
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.chatBody, children: renderSlot("conversation", {}) })
    ] }),
    narrow && !agentOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: S.fab, onClick: () => setAgentOpen(true), "data-grad-agent-fab": true, children: "\u{1F4AC} Agent" }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { position: "fixed", inset: 0, pointerEvents: "none", zIndex: 40 }, "data-shell-overlay": true, children: renderSlot("shell.overlay", {}) })
  ] });
}
function styles(pal) {
  return {
    frame: { display: "flex", height: "100%", minHeight: 0 },
    nav: {
      width: 232,
      flex: "none",
      borderRight: `1px solid ${pal.border}`,
      padding: "10px 8px",
      display: "flex",
      flexDirection: "column",
      gap: 2,
      overflowY: "auto",
      boxSizing: "border-box"
    },
    brand: { padding: "6px 10px 12px" },
    brandTitle: { fontSize: 14, fontWeight: 800 },
    brandSub: { fontSize: 10.5, color: pal.muted, marginTop: 2 },
    navList: { display: "flex", flexDirection: "column", gap: 8 },
    navGroup: { fontSize: 10.5, color: pal.muted, padding: "6px 10px 2px", letterSpacing: 0.4, textTransform: "uppercase" },
    navItem: (active) => ({
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "7px 10px",
      borderRadius: 8,
      cursor: "pointer",
      fontSize: 13,
      border: "none",
      color: pal.fg,
      background: active ? pal.accentSoft : "transparent",
      fontWeight: active ? 600 : 400
    }),
    main: { flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column" },
    mainHeader: { display: "flex", alignItems: "baseline", gap: 10, padding: "14px 20px 8px", borderBottom: `1px solid ${pal.border}` },
    mainTitle: { fontSize: 16, fontWeight: 800 },
    mainSub: { fontSize: 12, color: pal.muted },
    mainBody: { flex: "1 1 auto", minHeight: 0, overflow: "hidden" },
    pane: { height: "100%", overflow: "hidden" },
    chatCol: {
      width: 360,
      flex: "none",
      borderLeft: `1px solid ${pal.border}`,
      display: "flex",
      flexDirection: "column",
      minWidth: 0
    },
    chatHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${pal.border}` },
    chatBody: { flex: 1, minHeight: 0, overflow: "hidden" },
    fab: {
      position: "fixed",
      right: 18,
      bottom: 18,
      zIndex: 60,
      borderRadius: 999,
      border: `1px solid ${pal.border}`,
      background: pal.cardBg,
      color: pal.fg,
      padding: "9px 16px",
      fontSize: 13,
      cursor: "pointer",
      boxShadow: "0 4px 16px rgba(0,0,0,0.18)"
    }
  };
}
function loadSection() {
  try {
    const v = sessionStorage.getItem(NAV_KEY);
    if (v && ALL_ITEMS.some((n) => n.id === v)) return v;
  } catch {
  }
  return "dashboard";
}
var inject = ["slots", "sessions"];
function apply(ctx) {
  const disposeLayout = ctx.reflect.provide("layout", {
    toggleSidebar() {
    },
    openDetails() {
    },
    closeDetails() {
    }
  });
  const disposeRoot = ctx.slots.register(
    {
      name: "root",
      children: {
        sidebar: { kind: "single", scope: "root" },
        conversation: { kind: "single", scope: "session-maybe" },
        details: { kind: "single", scope: "session" },
        "shell.overlay": { kind: "list", scope: "root" },
        "grad.workbench": { kind: "single", scope: "session" }
      },
      inject: () => ({})
    },
    ShellFrame
  );
  ctx.effect(
    () => () => {
      disposeRoot();
      disposeLayout();
    },
    "grad-shell: dispose"
  );
}

    return module.exports;
  }
});
