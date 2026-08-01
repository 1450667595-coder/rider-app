import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/layout/Layout";

// 代码分割：懒加载所有页面
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Records = lazy(() => import("@/pages/Records"));
const Income = lazy(() => import("@/pages/Income"));
const Predict = lazy(() => import("@/pages/Predict"));
const Goals = lazy(() => import("@/pages/Goals"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Achievements = lazy(() => import("@/pages/Achievements"));
const Weekly = lazy(() => import("@/pages/Weekly"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-[#00E5FF]/30 border-t-[#00E5FF] rounded-full animate-spin" />
        <span className="text-[11px] text-[#00E5FF]/40 tracking-wider">加载中...</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
          <Route path="/records" element={<Suspense fallback={<PageLoader />}><Records /></Suspense>} />
          <Route path="/income" element={<Suspense fallback={<PageLoader />}><Income /></Suspense>} />
          <Route path="/predict" element={<Suspense fallback={<PageLoader />}><Predict /></Suspense>} />
          <Route path="/goals" element={<Suspense fallback={<PageLoader />}><Goals /></Suspense>} />
          <Route path="/weekly" element={<Suspense fallback={<PageLoader />}><Weekly /></Suspense>} />
          <Route path="/analytics" element={<Suspense fallback={<PageLoader />}><Analytics /></Suspense>} />
          <Route path="/achievements" element={<Suspense fallback={<PageLoader />}><Achievements /></Suspense>} />
        </Route>
      </Routes>
    </Router>
  );
}