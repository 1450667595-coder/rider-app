import { useState, useEffect } from "react";
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { getSyncStatus, onSyncChange, isSupabaseConfigured } from "@/services/supabase";
import { useTheme } from "@/hooks/useTheme";
import type { SyncStatus } from "@/services/supabase";

const STATUS_CONFIG: Record<SyncStatus, { icon: typeof Cloud; color: string; label: string }> = {
  idle: { icon: Cloud, color: "text-[#E0E0E0]/25", label: "就绪" },
  syncing: { icon: RefreshCw, color: "text-[#00E5FF] animate-spin", label: "同步中" },
  synced: { icon: CheckCircle2, color: "text-[#00E676]", label: "已同步" },
  error: { icon: AlertCircle, color: "text-[#FF1744]", label: "错误" },
  offline: { icon: CloudOff, color: "text-[#E0E0E0]/25", label: "离线" },
};

const IOS_STATUS_CONFIG: Record<SyncStatus, { icon: typeof Cloud; color: string; label: string }> = {
  idle: { icon: Cloud, color: "text-[#8E8E93]", label: "就绪" },
  syncing: { icon: RefreshCw, color: "text-[#007AFF] animate-spin", label: "同步中" },
  synced: { icon: CheckCircle2, color: "text-[#34C759]", label: "已同步" },
  error: { icon: AlertCircle, color: "text-[#FF3B30]", label: "错误" },
  offline: { icon: CloudOff, color: "text-[#8E8E93]", label: "离线" },
};

export default function SyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  const { isIOS } = useTheme();

  useEffect(() => {
    const unsub = onSyncChange(setStatus);
    return unsub;
  }, []);

  if (!isSupabaseConfigured()) return null;

  const config = isIOS ? IOS_STATUS_CONFIG[status] : STATUS_CONFIG[status];
  const Icon = config.icon;

  if (isIOS) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F2F2F7]">
        <Icon size={12} className={config.color} />
        <span className={`text-[9px] ${config.color}`}>{config.label}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{
        background: "rgba(0,229,255,0.04)",
        border: "1px solid rgba(0,229,255,0.1)",
      }}>
      <Icon size={12} className={config.color} />
      <span className={`terminal-text text-[9px] ${config.color}`}>{config.label}</span>
    </div>
  );
}
