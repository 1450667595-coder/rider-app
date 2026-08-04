import { Suspense, lazy } from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Dashboard from "@/pages/Dashboard";

// 非首屏页面懒加载，减少初始包体积，加快进入速度
// webpackPrefetch 让浏览器在空闲时自动预取，切换更顺滑
const Records = lazy(() => import(/* webpackPrefetch: true */ "@/pages/Records"));
const Income = lazy(() => import(/* webpackPrefetch: true */ "@/pages/Income"));
const Predict = lazy(() => import(/* webpackPrefetch: true */ "@/pages/Predict"));
const Goals = lazy(() => import(/* webpackPrefetch: true */ "@/pages/Goals"));
const Analytics = lazy(() => import(/* webpackPrefetch: true */ "@/pages/Analytics"));
const Achievements = lazy(() => import(/* webpackPrefetch: true */ "@/pages/Achievements"));
const Weekly = lazy(() => import(/* webpackPrefetch: true */ "@/pages/Weekly"));
const WhatIf = lazy(() => import(/* webpackPrefetch: true */ "@/pages/WhatIf"));

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#00E5FF]/20 border-t-[#00E5FF] animate-spin" />
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-[#00E5FF] neon-cyan">404</h1>
        <p className="text-[#E0E0E0]/60">页面不存在</p>
        <a href="/" className="text-[#00E5FF] hover:underline">返回首页</a>
      </div>
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
            <Route path="/whatif" element={<WhatIf />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}
