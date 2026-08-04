import { useEffect, useState, useCallback } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import BottomNav from "./BottomNav";
import ToastContainer from "@/components/shared/Toast";
import useStore from "@/store/useStore";
import type { SyncStatus } from "@/store/useStore";
import { isSupabaseConfigured } from "@/services/supabase";

// 独立时钟组件：状态不提升，避免 Layout 和 Outlet 每秒/每 30 秒重新渲染
function Clock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, "0");
      const m = now.getMinutes().toString().padStart(2, "0");
      setTime(`${h}:${m}`);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, []);
  return <span className="status-bar-clock">{time}</span>;
}

function getSyncLabel(status: SyncStatus): string {
  if (!isSupabaseConfigured()) return "未配置云端";
  switch (status) {
    case "synced": return "云端已同步";
    case "syncing": return "云端同步中...";
    case "error": return "云端同步失败";
    case "offline": return "云端离线";
    default: return "本地模式";
  }
}

export default function Layout() {
  const loadData = useStore((s) => s.loadData);
  const syncStatus = useStore((s) => s.syncStatus);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, [loadData]);

  const triggerSync = useCallback(() => {
    if (!isSupabaseConfigured()) {
      navigate("/settings");
      return;
    }
    loadData();
  }, [loadData, navigate]);

  return (
    <div className="min-h-screen min-h-dvh text-[#E0E0E0] relative">
      {/* 扫描线 */}
      <div className="scanlines-overlay" />

      {/* HUD 顶部扫描线 */}
      <div className="hud-scan-line" />

      {/* 顶部状态栏 */}
      <div className="top-status-bar">
        <div className="status-bar-left">
          <span className="system-status-indicator">
            <span className="system-status-dot" />
            系统正常
          </span>
          <span className="status-bar-sep" />
          <span
            className="status-bar-sync"
            onClick={triggerSync}
            style={{ cursor: "pointer" }}
          >
            <span className={`sync-dot ${syncStatus}`} />
            <span>{getSyncLabel(syncStatus)}</span>
          </span>
        </div>
        <div className="status-bar-right">
          <Clock />
        </div>
      </div>

      {/* Content layer */}
      <div
        className="max-w-lg mx-auto pb-28 relative z-10"
        style={{ paddingTop: "44px" }}
      >
        <Outlet />
      </div>

      {/* Navigation */}
      <BottomNav />
      <ToastContainer />
    </div>
  );
}