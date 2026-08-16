# 骑手工作台 · AI 智能预测系统 开发手册

## 项目概述
骑手工作台是一款专为外卖骑手设计的效率与收入管理应用。核心功能包括：
- **每日记录**：记录每日接单量、收入、工时、天气等
- **AI 预测**：基于历史数据预测未来单量和收入
- **班次管理**：灵活的班次锁定与轮换机制
- **多源天气**：三级降级天气 API，确保数据准确性
- **云同步**：多设备数据实时同步（Supabase + 自研 Node 服务器）

## 技术栈
| 层级 | 技术 | 版本 |
|------|------|------|
| 构建工具 | Vite | 6.x |
| 前端框架 | React | 18.3 |
| 状态管理 | Zustand | 5.x |
| 样式 | TailwindCSS | 3.x |
| 路由 | React Router | 7.x |
| 图表 | Recharts | 2.x |
| 图标 | Lucide React | latest |
| 后端（可选） | Node.js + Express | 4.x |
| 数据库（可选） | SQLite (better-sqlite3) | 11.x |
| 云服务 | Supabase | Postgres + Auth |

## 核心架构

### 目录结构
```
/workspace
├── src/
│   ├── components/      # UI 组件
│   │   ├── layout/      # 布局（底部导航、主框架）
│   │   └── shared/      # 共享组件（图表、天气、动画等）
│   ├── pages/           # 页面（Dashboard、Analytics、Records...）
│   ├── store/           # Zustand 全局状态
│   │   └── useStore.ts  # 核心状态管理
│   ├── services/        # 外部服务封装
│   │   ├── weather.ts   # 天气 API（三级降级）
│   │   ├── api.ts       # 自研后端 API
│   │   └── supabase.ts  # Supabase 云同步
│   ├── utils/           # 工具函数
│   │   ├── storage.ts   # 数据持久化（三重保障）
│   │   ├── prediction.ts # AI 预测算法
│   │   └── date.ts      # 日期处理
│   └── types/           # TypeScript 类型定义
├── server/              # Node.js 后端（可选）
│   ├── index.js         # Express 服务器
│   ├── db.js            # SQLite 数据库
│   └── migrate-settings.js # 数据库迁移
├── public/              # 静态资源
│   ├── sw.js            # Service Worker（PWA 缓存）
│   └── manifest.json    # PWA 配置
└── index.html           # 入口 HTML
```

## 核心模块详解

### 1. 数据持久化（三重保障）
**文件**: `src/utils/storage.ts`

数据安全是本应用的命脉。采用三重持久化策略：
- **LocalStorage**：快速读写，保存结构化数据
- **IndexedDB**：大容量存储，保存历史记录
- **云同步**（可选）：Supabase + 自研 Node 服务器

```typescript
// 班次锁定专用备份层（第四重保障）
interface ShiftLockBackup {
  weeklyShifts: Record<string, ShiftType>;
  weeklyShiftsUpdatedAt: number;
  savedAt: string;
}
```

**关键函数**：
- `saveStorageImmediate()`：紧急写入（班次锁定时调用）
- `mergeStorageData()`：合并数据时以最新时间戳为准
- `applyShiftLockBackup()`：从备份恢复锁定状态

### 2. 天气 API（三级降级策略）
**文件**: `src/services/weather.ts`

```
优先级：
1. wthrcdn.etouch.cn  →  中国天气源（最准确）
2. sojson.com         →  降级中国源（需城市代码）
3. Open-Meteo         →  全球降级源（精度一般）
```

**架构**：
- 前端通过 Node.js 代理请求天气 API，避免 HTTPS 混合内容问题
- 请求失败自动降级到下一个数据源
- 所有天气数据都附加 `source` 字段，便于溯源

```typescript
async function fetchWeatherByCity(city: string): Promise<WeatherData | null> {
  // 1. 优先中国源
  const wthrData = await fetchWthrcdnWeather(city);
  if (wthrData) return wthrData;

  // 2. 降级 sojson
  const cityCode = getCityCode(city);
  if (cityCode) {
    const sojsonData = await fetchSojsonWeather(cityCode);
    if (sojsonData) return sojsonData;
  }

  // 3. 降级 Open-Meteo（全球源）
  // ...
}
```

### 3. 班次锁定机制
**文件**: `src/store/useStore.ts`

**问题背景**：早期版本中，锁定的班次会被云端数据覆盖。

**解决方案**：
- `weeklyShiftsUpdatedAt` 时间戳：每次修改班次都更新此时间戳
- 合并策略：`mergeStorageData()` 和 `mergeCloudData()` 完全信任最新时间戳
- 即时持久化：`lockShift()` 和 `unlockShift()` 调用 `saveStorageImmediate()`
- 专用备份：`SHIFT_LOCK_BACKUP_KEY` 额外备份层

```typescript
lockShift: async (weekStart, shiftType) => {
  set((state) => {
    const weeklyShifts = { ...state.settings.weeklyShifts, [weekStart]: shiftType };
    const newSettings = { ...state.settings, weeklyShifts, weeklyShiftsUpdatedAt: Date.now() };
    const newState = { ...state, settings: newSettings };
    saveStorageImmediate(toStorageData(newState)); // 紧急写入
    saveShiftLockBackup(weeklyShifts, Date.now()); // 专用备份
    return { settings: newSettings };
  });
}
```

### 4. AI 预测算法
**文件**: `src/utils/prediction.ts`

采用加权移动平均 + 多因子修正模型：
- 历史数据权重递减（近期数据权重高）
- 天气因子修正（晴天 +15%，雨天 -10%）
- 周期因子修正（周末、节假日）

### 5. Service Worker（PWA 缓存策略）
**文件**: `public/sw.js`

**版本**: v4（已修复旧缓存污染问题）

**关键特性**：
- 导航请求：**网络优先**，确保用户看到最新版本
- 静态资源：**Stale-While-Revalidate**（先用缓存，后台更新）
- 核心资源（manifest、sw.js）：**网络优先**，避免旧缓存导致更新不生效
- 错误响应过滤：`cacheIfOk()` 函数只缓存 2xx 成功响应
- 旧版本清理：activate 时自动删除旧缓存

```javascript
// 只缓存成功响应，避免 401/404/500 错误被缓存
function cacheIfOk(cache, request, response) {
  if (!response || !response.ok) return response;
  cache.put(request, response.clone());
  return response;
}
```

## 开发指南

### 本地开发
```bash
# 安装依赖
npm install
cd server && npm install && cd ..

# 启动开发环境（同时启动前端和后端）
npm run dev:all
# 或分开启动
npm run dev        # 前端 http://localhost:5173
npm run dev:server # 后端 http://localhost:3001
```

### 生产构建
```bash
npm run build
# 产物在 dist/ 目录
```

### 代码规范
- TypeScript 严格模式
- 组件文件按 `PascalCase` 命名
- 工具函数文件按 `camelCase` 命名
- 状态管理统一走 Zustand，禁止在组件中直接操作 localStorage

## 已知陷阱与解决方案

### 1. HTTPS 混合内容问题
**问题**: 在 HTTPS 页面请求 HTTP 天气 API 会被浏览器拦截。
**解决方案**: 所有第三方 API 请求走 Node.js 代理 `/api/weather/*`。

### 2. 班次锁定丢失
**问题**: 早期版本中锁定的班次会被旧数据覆盖。
**解决方案**: 三重保障机制（时间戳 + 即时写入 + 专用备份）。

### 3. Service Worker 缓存污染
**问题**: 旧版 SW 会把 401 等错误响应缓存，导致页面无法加载。
**解决方案**: SW v4 的 `cacheIfOk()` 函数过滤错误响应。

### 4. iOS 主题残留
**问题**: 之前的版本有 iOS 主题分支，已彻底删除。
**解决方案**: 全局搜索 `ios-theme`、`isIOS`、`theme-ios` 确认无残留。

## 部署

### GitHub Pages（当前部署方式）
```bash
git push origin master
# GitHub Actions 自动构建并部署
```

### 环境变量
在 `.env` 文件中配置：
```
VITE_API_URL=            # 后端 API 地址
VITE_SUPABASE_URL=       # Supabase 项目 URL
VITE_SUPABASE_ANON_KEY=  # Supabase 匿名密钥
```

## 联系方式
如有问题请联系原作者（Trae AI），或查阅项目中的 `.trae/documents/` 目录获取 PRD 和技术文档。
