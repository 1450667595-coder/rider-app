import fs from "node:fs";
import path from "node:path";

const srcDir = path.resolve(process.cwd(), "src");
const outFile = path.resolve(process.cwd(), "src/ios-theme.css");

const COLOR_MAP = {
  // 背景色 → iOS 浅色系
  "#020408": "#F2F2F7",
  "#060A12": "#F2F2F7",
  "#0A0F1A": "#FFFFFF",
  "#0E1422": "#FFFFFF",
  "#1A1A2E": "#FFFFFF",
  // 文字色
  "#E0E0E0": "#1C1C1E",
  "#fff": "#000000",
  "#ffffff": "#000000",
  // 主色/强调色 → iOS 系统色
  "#00E5FF": "#007AFF",
  "#00B0D0": "#007AFF",
  "#00D2FF": "#007AFF",
  "#4B6BFB": "#007AFF",
  "#E040FB": "#AF52DE",
  "#7B2FF7": "#5856D6",
  "#C51162": "#FF2D55",
  "#FF4081": "#FF2D55",
  "#FF6B9D": "#FF2D55",
  "#FFD740": "#FF9500",
  "#FF6D00": "#FF9500",
  "#FF8C00": "#FF9500",
  "#FF6B35": "#FF9500",
  "#FFD100": "#FFCC00",
  "#00E676": "#34C759",
  "#FF1744": "#FF3B30",
};

function expandHex(hex) {
  hex = hex.toLowerCase();
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  if (hex.length === 5) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}${hex[4]}${hex[4]}`;
  }
  return hex;
}

function hexToRgb(hex) {
  const h = expandHex(hex).replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return { r, g, b };
}

function rgbValue(hex, opacity) {
  const { r, g, b } = hexToRgb(hex);
  if (opacity === 100) return `rgb(${r} ${g} ${b})`;
  return `rgb(${r} ${g} ${b} / ${opacity / 100})`;
}

function escapeSelector(str) {
  return str
    .replace(/\//g, "\\/")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/#/g, "\\#")
    .replace(/\./g, "\\.");
}

const rules = new Map();

function addRule(className, declaration) {
  const existing = rules.get(className);
  if (existing) {
    existing.add(declaration);
  } else {
    rules.set(className, new Set([declaration]));
  }
}

function processUtility(match) {
  const [, prefix, hex, opacityStr] = match;
  const mappedHex = COLOR_MAP[`#${hex.toUpperCase()}`];
  if (!mappedHex) return;
  const opacity = opacityStr ? parseInt(opacityStr, 10) : 100;
  const value = rgbValue(mappedHex, opacity);
  const cls = `${prefix}-[#${hex}]${opacityStr ? `/${opacityStr}` : ""}`;

  switch (prefix) {
    case "text":
      addRule(cls, `color: ${value} !important;`);
      break;
    case "bg":
      addRule(cls, `background-color: ${value} !important;`);
      break;
    case "border":
      addRule(cls, `border-color: ${value} !important;`);
      break;
    case "border-t":
      addRule(cls, `border-top-color: ${value} !important;`);
      break;
    case "border-b":
      addRule(cls, `border-bottom-color: ${value} !important;`);
      break;
    case "border-l":
      addRule(cls, `border-left-color: ${value} !important;`);
      break;
    case "border-r":
      addRule(cls, `border-right-color: ${value} !important;`);
      break;
    case "border-x":
      addRule(cls, `border-left-color: ${value} !important;`);
      addRule(cls, `border-right-color: ${value} !important;`);
      break;
    case "border-y":
      addRule(cls, `border-top-color: ${value} !important;`);
      addRule(cls, `border-bottom-color: ${value} !important;`);
      break;
    case "ring":
      addRule(cls, `--tw-ring-color: ${value} !important;`);
      break;
    case "ring-offset":
      addRule(cls, `--tw-ring-offset-color: ${value} !important;`);
      break;
    case "fill":
      addRule(cls, `fill: ${value} !important;`);
      break;
    case "stroke":
      addRule(cls, `stroke: ${value} !important;`);
      break;
    case "outline":
      addRule(cls, `outline-color: ${value} !important;`);
      break;
    case "from": {
      const zero = rgbValue(mappedHex, 0);
      addRule(cls, `--tw-gradient-from: ${value} var(--tw-gradient-from-position) !important;`);
      addRule(cls, `--tw-gradient-to: ${zero} var(--tw-gradient-to-position) !important;`);
      addRule(cls, `--tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important;`);
      break;
    }
    case "to":
      addRule(cls, `--tw-gradient-to: ${value} var(--tw-gradient-to-position) !important;`);
      addRule(cls, `--tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important;`);
      break;
  }
}

const utilityRegex = /\b(text|bg|from|to|ring|ring-offset|fill|stroke|outline|border(?:-[trblxy])?)-\[#([0-9A-Fa-f]{3,8})\](?:\/(\d{1,3}))?/g;

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  let m;
  while ((m = utilityRegex.exec(content)) !== null) {
    processUtility(m);
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      scanFile(full);
    }
  }
}

walk(srcDir);

let css = `/* iOS Glass Theme - auto-generated color mappings + manual overrides */
.theme-ios {
  /* iOS color variables */
  --ios-bg: #F2F2F7;
  --ios-bg-secondary: #E5E5EA;
  --ios-surface: rgba(255, 255, 255, 0.72);
  --ios-surface-solid: #FFFFFF;
  --ios-surface-elevated: rgba(255, 255, 255, 0.88);
  --ios-border: rgba(120, 120, 128, 0.16);
  --ios-border-strong: rgba(120, 120, 128, 0.24);
  --ios-text: #1C1C1E;
  --ios-text-secondary: #8E8E93;
  --ios-text-tertiary: #C7C7CC;
  --ios-blue: #007AFF;
  --ios-purple: #AF52DE;
  --ios-orange: #FF9500;
  --ios-green: #34C759;
  --ios-red: #FF3B30;
  --ios-pink: #FF2D55;
  --ios-indigo: #5856D6;
  --ios-yellow: #FFCC00;
  --ios-teal: #5AC8FA;
  --ios-shadow: rgba(0, 0, 0, 0.08);
  --ios-shadow-strong: rgba(0, 0, 0, 0.16);
}

`;

for (const [cls, decls] of rules) {
  css += `.theme-ios .${escapeSelector(cls)} {\n`;
  for (const decl of decls) {
    css += `  ${decl}\n`;
  }
  css += `}\n\n`;
}

const structural = `
/* ═══════════════════════════════════════════════════
   iOS Glassmorphism 2.0 液态玻璃全局覆盖
   ═══════════════════════════════════════════════════ */

.theme-ios html,
.theme-ios body {
  background: var(--ios-bg) !important;
  color: var(--ios-text) !important;
}

/* 移除赛博风格的动态网格、辉光、扫描线 */
.theme-ios body::before,
.theme-ios body::after,
.theme-ios .scanlines-overlay,
.theme-ios .hud-scan-line,
.theme-ios .cyber-particles::before,
.theme-ios .holo-data-bg::before {
  display: none !important;
}

/* 添加 iOS 柔和背景：分层模糊渐变 */
.theme-ios #root {
  background:
    radial-gradient(ellipse at 10% 10%, rgba(0, 122, 255, 0.06) 0%, transparent 45%),
    radial-gradient(ellipse at 90% 20%, rgba(175, 82, 222, 0.05) 0%, transparent 40%),
    radial-gradient(ellipse at 50% 90%, rgba(255, 149, 0, 0.04) 0%, transparent 45%),
    var(--ios-bg);
  min-height: 100vh;
  min-height: 100dvh;
}

/* ═══════════════════════════════════════════════════
   玻璃卡片
   ═══════════════════════════════════════════════════ */
.theme-ios .holo-card,
.theme-ios .holo-card-strong,
.theme-ios .holo-card-gold {
  background: var(--ios-surface) !important;
  backdrop-filter: blur(24px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
  border: 1px solid var(--ios-border) !important;
  border-radius: 26px !important;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.04),
    0 1px 3px rgba(0, 0, 0, 0.04),
    inset 0 0 0 1px rgba(255, 255, 255, 0.4) !important;
}

.theme-ios .holo-card::before,
.theme-ios .holo-card::after,
.theme-ios .holo-card-strong::before,
.theme-ios .holo-card-strong::after,
.theme-ios .holo-card-gold::before,
.theme-ios .holo-card-gold::after {
  display: none !important;
}

.theme-ios .holo-card:hover,
.theme-ios .holo-card-strong:hover,
.theme-ios .holo-card-gold:hover {
  box-shadow:
    0 8px 36px rgba(0, 0, 0, 0.08),
    0 1px 3px rgba(0, 0, 0, 0.04),
    inset 0 0 0 1px rgba(255, 255, 255, 0.5) !important;
}

/* 角落装饰移除 */
.theme-ios .corner-brackets::before,
.theme-ios .corner-brackets::after {
  display: none !important;
}

/* ═══════════════════════════════════════════════════
   按钮
   ═══════════════════════════════════════════════════ */
.theme-ios .btn-cyber {
  background: rgba(255, 255, 255, 0.6) !important;
  border: 1px solid var(--ios-border) !important;
  color: var(--ios-blue) !important;
  border-radius: 18px !important;
  font-weight: 600 !important;
  box-shadow: 0 2px 12px var(--ios-shadow) !important;
  text-shadow: none !important;
}

.theme-ios .btn-cyber-primary {
  background: var(--ios-blue) !important;
  color: #FFFFFF !important;
  border-radius: 20px !important;
  font-weight: 700 !important;
  box-shadow: 0 4px 20px rgba(0, 122, 255, 0.28) !important;
}

.theme-ios .btn-cyber-danger {
  background: rgba(255, 59, 48, 0.08) !important;
  border: 1px solid rgba(255, 59, 48, 0.2) !important;
  color: var(--ios-red) !important;
  border-radius: 18px !important;
}

/* ═══════════════════════════════════════════════════
   输入框
   ═══════════════════════════════════════════════════ */
.theme-ios .input-cyber,
.theme-ios select.input-cyber {
  background: rgba(255, 255, 255, 0.55) !important;
  border: 1px solid var(--ios-border) !important;
  color: var(--ios-text) !important;
  border-radius: 16px !important;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04) !important;
}

.theme-ios .input-cyber::placeholder {
  color: var(--ios-text-tertiary) !important;
}

.theme-ios .input-cyber:focus {
  border-color: var(--ios-blue) !important;
  box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.12), inset 0 1px 2px rgba(0, 0, 0, 0.04) !important;
}

/* ═══════════════════════════════════════════════════
   徽章
   ═══════════════════════════════════════════════════ */
.theme-ios .badge-cyber {
  background: rgba(0, 122, 255, 0.1) !important;
  border: 1px solid rgba(0, 122, 255, 0.18) !important;
  color: var(--ios-blue) !important;
}

.theme-ios .badge-cyber-gold {
  background: rgba(255, 149, 0, 0.1) !important;
  border: 1px solid rgba(255, 149, 0, 0.18) !important;
  color: var(--ios-orange) !important;
}

.theme-ios .badge-cyber-green {
  background: rgba(52, 199, 89, 0.1) !important;
  border: 1px solid rgba(52, 199, 89, 0.18) !important;
  color: var(--ios-green) !important;
}

.theme-ios .badge-cyber-red {
  background: rgba(255, 59, 48, 0.1) !important;
  border: 1px solid rgba(255, 59, 48, 0.18) !important;
  color: var(--ios-red) !important;
}

/* ═══════════════════════════════════════════════════
   进度条
   ═══════════════════════════════════════════════════ */
.theme-ios .progress-cyber {
  background: rgba(0, 0, 0, 0.05) !important;
  border: none !important;
  height: 6px !important;
  border-radius: 999px !important;
  overflow: hidden !important;
}

.theme-ios .progress-cyber-fill {
  background: var(--ios-blue) !important;
  box-shadow: none !important;
}

.theme-ios .progress-cyber-fill-gold {
  background: var(--ios-orange) !important;
}

/* ═══════════════════════════════════════════════════
   底部导航
   ═══════════════════════════════════════════════════ */
.theme-ios .cyber-nav {
  background: rgba(255, 255, 255, 0.78) !important;
  backdrop-filter: blur(24px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
  border-top: 1px solid var(--ios-border) !important;
  box-shadow: 0 -4px 24px var(--ios-shadow) !important;
}

.theme-ios .nav-glow-tracker {
  display: none !important;
}

.theme-ios .nav-cyber-active::before {
  display: none !important;
}

.theme-ios [data-nav-item] svg {
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
}

.theme-ios [data-nav-item].nav-cyber-active svg {
  transform: scale(1.08) !important;
}

.theme-ios [data-nav-item] span {
  font-weight: 500 !important;
}

/* ═══════════════════════════════════════════════════
   顶部状态栏
   ═══════════════════════════════════════════════════ */
.theme-ios .top-status-bar {
  background: rgba(255, 255, 255, 0.72) !important;
  backdrop-filter: blur(20px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(20px) saturate(160%) !important;
  border-bottom: 1px solid var(--ios-border) !important;
  color: var(--ios-text-secondary) !important;
}

.theme-ios .status-bar-clock {
  color: var(--ios-text) !important;
  font-weight: 600 !important;
}

.theme-ios .sync-dot {
  box-shadow: none !important;
}

.theme-ios .sync-dot.syncing { background: var(--ios-blue) !important; }
.theme-ios .sync-dot.synced { background: var(--ios-green) !important; }
.theme-ios .sync-dot.offline { background: var(--ios-red) !important; }

.theme-ios .system-status-dot {
  box-shadow: none !important;
  background: var(--ios-green) !important;
}

.theme-ios .system-status-indicator {
  color: var(--ios-text-secondary) !important;
}

/* ═══════════════════════════════════════════════════
   文字特效
   ═══════════════════════════════════════════════════ */
.theme-ios .neon-cyan,
.theme-ios .neon-gold,
.theme-ios .neon-magenta,
.theme-ios .neon-green {
  text-shadow: none !important;
}

.theme-ios .terminal-text {
  color: var(--ios-text-secondary) !important;
}

.theme-ios .cyber-section-title {
  color: var(--ios-text-secondary) !important;
  font-weight: 600 !important;
}

.theme-ios .cyber-section-title::after {
  background: var(--ios-border) !important;
}

.theme-ios .cyber-divider {
  background: var(--ios-border) !important;
}

.theme-ios .cyber-data-row {
  border-bottom-color: var(--ios-border) !important;
}

/* ═══════════════════════════════════════════════════
   点击反馈
   ═══════════════════════════════════════════════════ */
.theme-ios .tap-cyber {
  transition: transform 0.15s ease, opacity 0.15s ease !important;
}

.theme-ios .tap-cyber:active {
  transform: scale(0.96) !important;
  opacity: 0.85 !important;
}

.theme-ios .icon-glow-cyan,
.theme-ios .icon-glow-gold,
.theme-ios .icon-glow-magenta,
.theme-ios .icon-glow-green {
  filter: none !important;
}

/* ═══════════════════════════════════════════════════
   滚动条与选区
   ═══════════════════════════════════════════════════ */
.theme-ios ::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12) !important;
  border-radius: 999px !important;
}

.theme-ios ::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.22) !important;
}

.theme-ios ::selection {
  background: rgba(0, 122, 255, 0.2) !important;
  color: var(--ios-text) !important;
}

/* ═══════════════════════════════════════════════════
   图表工具提示
   ═══════════════════════════════════════════════════ */
.theme-ios .recharts-default-tooltip {
  background: rgba(255, 255, 255, 0.92) !important;
  border: 1px solid var(--ios-border) !important;
  box-shadow: 0 8px 32px var(--ios-shadow) !important;
  border-radius: 14px !important;
}

/* ═══════════════════════════════════════════════════
   启动画面
   ═══════════════════════════════════════════════════ */
.theme-ios .boot-screen {
  background: var(--ios-bg) !important;
}

.theme-ios .boot-logo {
  color: var(--ios-blue) !important;
  text-shadow: none !important;
  font-weight: 800 !important;
}

.theme-ios .boot-progress {
  background: rgba(0, 0, 0, 0.08) !important;
  border-radius: 999px !important;
  overflow: hidden !important;
}

.theme-ios .boot-progress-fill {
  background: var(--ios-blue) !important;
  box-shadow: none !important;
}

.theme-ios .boot-log {
  color: var(--ios-text-secondary) !important;
}

/* ═══════════════════════════════════════════════════
   悬浮按钮 FAB
   ═══════════════════════════════════════════════════ */
.theme-ios .fab-button {
  background: var(--ios-blue) !important;
  box-shadow: 0 6px 24px rgba(0, 122, 255, 0.28) !important;
}

.theme-ios .fab-menu-item {
  background: rgba(255, 255, 255, 0.85) !important;
  border: 1px solid var(--ios-border) !important;
  color: var(--ios-text) !important;
  box-shadow: 0 8px 32px var(--ios-shadow) !important;
}

.theme-ios .fab-menu-item:hover {
  background: rgba(255, 255, 255, 1) !important;
}

/* ═══════════════════════════════════════════════════
   底部弹层
   ═══════════════════════════════════════════════════ */
.theme-ios [data-rsbs-backdrop] {
  background: rgba(0, 0, 0, 0.25) !important;
}

.theme-ios [data-rsbs-overlay] {
  background: var(--ios-surface-elevated) !important;
  border-top-left-radius: 26px !important;
  border-top-right-radius: 26px !important;
  backdrop-filter: blur(24px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
}

/* ═══════════════════════════════════════════════════
   五彩纸屑
   ═══════════════════════════════════════════════════ */
.theme-ios .confetti-piece {
  filter: saturate(0.85) !important;
}

/* ═══════════════════════════════════════════════════
   列表项与数据行通用优化
   ═══════════════════════════════════════════════════ */
.theme-ios .cyber-list-item {
  background: var(--ios-surface) !important;
  border: 1px solid var(--ios-border) !important;
  border-radius: 20px !important;
  box-shadow: 0 2px 12px var(--ios-shadow) !important;
}

/* 针对 inline style 中写死的深黑背景做兜底覆盖 */
.theme-ios [style*="background-color: rgb(26, 26, 46)"] {
  background: var(--ios-surface-solid) !important;
}

/* 日期选择器、原生输入框 */
.theme-ios input[type="date"]::-webkit-calendar-picker-indicator,
.theme-ios input[type="time"]::-webkit-calendar-picker-indicator {
  filter: invert(0.4) !important;
}
`;

css += structural;

fs.writeFileSync(outFile, css);
console.log(`Generated ${outFile} with ${rules.size} color mappings.`);
