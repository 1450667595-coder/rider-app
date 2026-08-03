import { Suspense, lazy } from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Dashboard from "@/pages/Dashboard";

// 非首屏页面懒加载，减少初始包体积，加快进入速度
const Records = lazy(() => import("@/pages/Records"));
const Income = lazy(() => import("@/pages/Income"));
const Predict = lazy(() => import("@/pages/Predict"));
const Goals = lazy(() => import("@/pages/Goals"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Achievements = lazy(() => import("@/pages/Achievements"));
const Weekly = lazy(() => import("@/pages/Weekly"));

// 预加载入口：导航条 hover 或空闲时可以提前拉取
export const prefetchPage = {
  records: () => import("@/pages/Records"),
  income: () => import("@/pages/Income"),
  predict: () => import("@/pages/Predict"),
  goals: () => import("@/pages/Goals"),
  analytics: () => import("@/pages/Analytics"),
  achievements: () => import("@/pages/Achievements"),
  weekly: () => import("@/pages/Weekly"),
};

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#00E5FF]/20 border-t-[#00E5FF] animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/records" element={<Records />} />
            <Route path="/income" element={<Income />} />
            <Route path="/predict" element={<Predict />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/weekly" element={<Weekly />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/achievements" element={<Achievements />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}
