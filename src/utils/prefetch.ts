// 页面预加载映射 — 独立文件，避免 App.tsx 与 BottomNav.tsx 循环依赖
export const prefetchPage = {
  records: () => import("@/pages/Records"),
  income: () => import("@/pages/Income"),
  predict: () => import("@/pages/Predict"),
  goals: () => import("@/pages/Goals"),
  analytics: () => import("@/pages/Analytics"),
  achievements: () => import("@/pages/Achievements"),
  weekly: () => import("@/pages/Weekly"),
  whatif: () => import("@/pages/WhatIf"),
};
