import { motion } from "framer-motion";
import { WifiOff, RefreshCw, CloudOff, Database } from "lucide-react";

/**
 * 离线降级兜底组件：
 * 当 Service Worker 缓存中找不到目标页面（或首次断网访问）时，
 * 用这个组件替代白屏 / 浏览器错误页。
 *
 * 使用方式（可选）：
 * - 在 Layout 中当 Outlet 懒加载失败且 network 离线时展示
 * - 或直接在 main.tsx 中挂载一个独立的 fallback，通过 error boundary 触发
 *
 * 这里做成纯展示组件，被 Layout / App / 错误边界按需引用即可。
 */
export default function OfflineFallback() {
  const retry = () => window.location.reload();

  return (
    <div className="min-h-screen min-h-dvh flex items-center justify-center px-6 cyber-particles text-[#E0E0E0]">
      {/* 背景装饰层 */}
      <div className="scanlines-overlay pointer-events-none" />
      <div className="hud-scan-line pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md holo-card rounded-[28px] p-6 text-center space-y-6"
      >
        {/* 图标 */}
        <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center relative">
          <div
            className="absolute inset-0 rounded-full animate-pulse"
            style={{
              background: "radial-gradient(circle, rgba(244,67,54,0.25), transparent 70%)",
            }}
          />
          <div
            className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(244,67,54,0.1)",
              border: "1px solid rgba(244,67,54,0.4)",
              boxShadow: "0 0 30px rgba(244,67,54,0.2)",
            }}
          >
            <CloudOff size={30} style={{ color: "#FF5252" }} />
          </div>
        </div>

        {/* 标题 + 描述 */}
        <div className="space-y-2">
          <h1 className="text-xl font-bold" style={{ color: "#FF8A80" }}>
            连接已断开
          </h1>
          <p className="text-[13px] leading-relaxed text-[#E0E0E0]/60">
            当前无法访问服务器，可能处于离线状态。
            已缓存的本地数据和功能仍可正常使用，
            网络恢复后所有修改将自动同步。
          </p>
        </div>

        {/* 功能提示列表 */}
        <div
          className="rounded-2xl p-4 space-y-3 text-left"
          style={{
            background: "rgba(0,229,255,0.04)",
            border: "1px solid rgba(0,229,255,0.1)",
          }}
        >
          <div className="flex items-start gap-3">
            <Database
              size={16}
              className="mt-0.5 flex-shrink-0"
              style={{ color: "#00E5FF" }}
            />
            <div>
              <div className="text-[12px] font-medium">本地数据可用</div>
              <div className="text-[11px] text-[#E0E0E0]/40">
                查看历史记录、目标、成就、收入分析
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <WifiOff
              size={16}
              className="mt-0.5 flex-shrink-0"
              style={{ color: "#FFC107" }}
            />
            <div>
              <div className="text-[12px] font-medium">需要网络的功能</div>
              <div className="text-[11px] text-[#E0E0E0]/40">
                天气获取、云端同步、AI 预测更新将在恢复后重试
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3">
          <button
            onClick={retry}
            className="tap-cyber flex-1 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 transition-all"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,229,255,0.18), rgba(123,47,247,0.18))",
              border: "1px solid rgba(0,229,255,0.4)",
              boxShadow: "0 8px 30px rgba(0,229,255,0.15)",
            }}
          >
            <RefreshCw size={14} className="animate-spin" style={{ animationDuration: "2s" }} />
            <span className="text-[13px] font-semibold">重新连接</span>
          </button>
        </div>

        <div className="text-[9px] font-mono text-[#E0E0E0]/20 tracking-wider">
          RIDER-WORKBENCH · OFFLINE MODE
        </div>
      </motion.div>
    </div>
  );
}
