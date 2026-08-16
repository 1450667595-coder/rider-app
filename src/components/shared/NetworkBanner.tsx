import { AnimatePresence, motion } from "framer-motion";
import { Wifi, WifiOff, RefreshCw, Signal } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

/**
 * 顶部断网横幅：
 * - 完全离线：红色警告，提示用户检查网络
 * - 弱网（slow-2g / 2g）：黄色提示，数据可能加载慢
 * - 恢复在线：绿色确认提示，2 秒后自动消失
 *
 * 配合 Service Worker：
 * 断网时用户依然可以使用已缓存的本地功能（本地记录、历史数据等），
 * 但云端同步/天气获取等需要网络的操作会被提示。
 */
export default function NetworkBanner() {
  const { isOnline, isReady, effectiveType } = useNetworkStatus();

  // 首次挂载前不展示，避免 SSR / 首屏闪烁
  if (!isReady) return null;

  let mode: "offline" | "weak" | null = null;
  if (!isOnline) mode = "offline";
  else if (effectiveType === "slow-2g" || effectiveType === "2g") mode = "weak";

  return (
    <AnimatePresence initial={false}>
      {mode && (
        <motion.div
          key={mode}
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed left-0 right-0 top-0 z-[100] flex justify-center pt-1 px-3 pointer-events-none"
        >
          <div
            className="pointer-events-auto w-full max-w-lg flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur-md"
            style={{
              background:
                mode === "offline"
                  ? "linear-gradient(90deg, rgba(244,67,54,0.18), rgba(244,67,54,0.08))"
                  : "linear-gradient(90deg, rgba(255,193,7,0.18), rgba(255,193,7,0.08))",
              border: `1px solid ${
                mode === "offline" ? "rgba(244,67,54,0.4)" : "rgba(255,193,7,0.4)"
              }`,
              boxShadow:
                mode === "offline"
                  ? "0 4px 20px rgba(244,67,54,0.15)"
                  : "0 4px 20px rgba(255,193,7,0.15)",
            }}
          >
            {mode === "offline" ? (
              <WifiOff size={12} style={{ color: "#F44336" }} />
            ) : (
              <Signal size={12} style={{ color: "#FFC107" }} />
            )}
            <span
              className="text-[10px] font-medium"
              style={{ color: mode === "offline" ? "#FF8A80" : "#FFD54F" }}
            >
              {mode === "offline"
                ? "网络已断开 · 已进入离线模式，本地数据仍可正常使用"
                : `弱网环境 (${effectiveType}) · 数据加载可能较慢`}
            </span>
            {mode === "offline" ? (
              <Wifi
                size={10}
                className="ml-auto"
                style={{ color: "rgba(244,67,54,0.5)" }}
              />
            ) : (
              <RefreshCw
                size={10}
                className="ml-auto animate-spin"
                style={{ color: "rgba(255,193,7,0.5)", animationDuration: "2.5s" }}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
