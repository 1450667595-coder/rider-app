# 骑手工作台 · 开发者交接指南 (Handoff Guide)

## 👋 欢迎 Codex

你好！我是 **Trae AI**，这个项目的原作者和技术监工。本指南将帮助你快速接手项目，并在现有基础上进行深度开发。

---

## 📦 项目概述

**骑手工作台**是一款为外卖骑手设计的效率与收入管理 PWA 应用。
- **线上地址**: https://1450667595-coder.github.io/rider-app/
- **技术栈**: React 18 + Vite 6 + Zustand + TailwindCSS + Recharts

---

## 🚀 快速启动

### 环境要求
- Node.js >= 20
- npm >= 10

### 安装与运行

```bash
# 1. 进入项目目录
cd rider-app

# 2. 安装依赖
npm install
cd server && npm install && cd ..

# 3. 启动开发环境（推荐）
npm run dev:all
# 这会同时启动：
#   - 前端: http://localhost:5173
#   - 后端: http://localhost:3001

# 4. 单独启动
npm run dev          # 仅前端
npm run dev:server   # 仅后端
```

### 常用命令

| 命令 | 作用 |
|------|------|
| `npm run dev` | 启动前端开发服务器 |
| `npm run dev:server` | 启动后端 API 服务 |
| `npm run dev:all` | 同时启动前后端（推荐） |
| `npm run build` | 生产构建（TypeScript + Vite） |
| `npm run check` | TypeScript 类型检查 |

---

## 🏗️ 项目架构

```
rider-app/
├── src/
│   ├── components/       # UI 组件
│   │   ├── layout/       # 布局组件
│   │   └── shared/       # 共享组件（图表、天气、动画）
│   ├── pages/            # 页面
│   │   ├── Dashboard.tsx # 首页仪表盘
│   │   ├── Analytics.tsx # 数据分析
│   │   ├── Records.tsx   # 记录管理
│   │   ├── Goals.tsx     # 目标与班次锁定
│   │   └── ...
│   ├── store/            # Zustand 状态管理
│   │   └── useStore.ts   # 核心状态（最重要）
│   ├── services/         # 外部服务
│   │   ├── weather.ts    # 天气 API（三级降级）
│   │   ├── api.ts        # 自研后端 API
│   │   └── supabase.ts   # Supabase 云同步
│   ├── utils/            # 工具函数
│   │   ├── storage.ts    # 数据持久化（三重保障）
│   │   ├── prediction.ts # AI 预测算法
│   │   └── date.ts       # 日期处理
│   └── types/            # TypeScript 类型
├── server/               # Node.js 后端
│   ├── index.js          # Express 服务器
│   └── db.js             # SQLite 数据库
├── public/               # 静态资源
│   └── sw.js             # Service Worker（v4）
└── AGENT_CONTEXT.md      # 详细技术手册（必读）
```

---

## 🎯 你的开发任务

### 优先级 P0：稳定性与体验
1. **班次锁定机制验证**
   - 测试场景：多设备同步、网络中断恢复、长时间运行
   - 关键文件：`src/store/useStore.ts`、`src/utils/storage.ts`
   - 验收标准：锁定状态 100% 不丢失

2. **天气 API 稳定性**
   - 添加请求超时和重试机制
   - 在 UI 展示天气数据来源标签
   - 关键文件：`src/services/weather.ts`

3. **PWA 离线支持**
   - 添加断网友好提示页面
   - 完善 Service Worker 缓存策略
   - 关键文件：`public/sw.js`

### 优先级 P1：功能增强
1. **AI 预测优化**
   - 新增"最佳跑单时段"热力图
   - 引入运力供需分析
   - 关键文件：`src/utils/prediction.ts`、`src/pages/Analytics.tsx`

2. **数据报表**
   - 收入 vs 天气对比图表
   - 最佳赚钱路径分析
   - 关键文件：`src/pages/Analytics.tsx`

3. **签到功能**
   - 记录开工/收工时间
   - 日工作时长统计
   - 新建页面或集成到 Dashboard

### 优先级 P2：UI/UX 打磨
1. **赛博风动效优化**
   - 数字滚动动画
   - 脉冲进度条
   - 暗色主题对比度优化
   - 关键文件：`src/index.css`、`src/components/shared/`

---

## ⚠️ 已知陷阱（必读）

### 1. HTTPS 混合内容问题
**问题**: HTTPS 页面请求 HTTP 天气 API 会被浏览器拦截。
**解决**: 所有第三方 API 请求走 Node.js 代理。
**文件**: `server/index.js` 的 `/api/weather/*` 路由。

### 2. 班次锁定丢失
**问题**: 早期版本中锁定的班次会被旧数据覆盖。
**解决**: 采用三重保障机制。
**详情**: 参见 `AGENT_CONTEXT.md` 的"班次锁定机制"章节。

### 3. Service Worker 缓存污染
**问题**: 旧版 SW 会把错误响应缓存。
**解决**: SW v4 版本只缓存 2xx 成功响应。
**文件**: `public/sw.js` 中的 `cacheIfOk()` 函数。

### 4. iOS 主题残留
**背景**: 之前版本有 iOS 主题分支。
**状态**: 已彻底删除，当前为纯赛博风 UI。

---

## 📖 必读文档

请在开发前阅读以下文件：
1. **`AGENT_CONTEXT.md`** — 核心技术手册（架构、算法、API 详解）
2. **`README.md`** — 项目说明
3. **`.trae/documents/PRD.md`** — 产品需求文档（如有）

---

## 🛠️ 开发规范

1. **TypeScript 严格模式**：所有新代码必须通过类型检查
2. **状态管理**：禁止直接操作 localStorage，统一走 Zustand store
3. **API 请求**：必须通过 `src/services/` 封装，禁止在组件中直接 fetch
4. **样式规范**：使用 TailwindCSS + CSS Modules，禁止使用 `!important` 滥用
5. **性能原则**：
   - 动画使用 `transform` 而非 `top/left`
   - 避免不必要的 `transition-all`
   - 使用 `will-change` 隔离复杂动画

---

## 📞 遇到问题？

作为技术监工，我建议你：
1. 先查阅 `AGENT_CONTEXT.md` 和 `src/` 下的代码
2. 如果遇到编译错误，先运行 `npm run check` 定位问题
3. 如果需要我协助，随时请用户联系我（Trae AI）

---

## ✅ 验收清单

每次提交代码前，请确保：
- [ ] `npm run check` 无 TypeScript 错误
- [ ] `npm run build` 构建成功
- [ ] 原有功能未被破坏
- [ ] 新功能有基本的错误处理
- [ ] 代码风格与项目一致

---

**祝你开发顺利！让我们一起打造最强骑手工作台 🚀**
