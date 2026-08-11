import { useState, useEffect } from "react";
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { getSyncStatus, onSyncChange, isSupabaseConfigured } from "@/services/supabase";
import type { SyncStatus } from "@/services/supabase";

const STATUS_CONFIG: Record<SyncStatus, { icon: typeof Cloud; color: string; label: string }> = {
  idle: { icon: Cloud, color: "text-[#E0E0E0]/25", label: "就绪" },
  syncing: { icon: RefreshCw, color: "text-[#00E5FF] animate-spin", label: "同步中" },
  synced: { icon: CheckCircle2, color: "text-[#00E676]", label: "已同步" },
  error: { icon: AlertCircle, color: "text-[#FF1744]", label: "错误" },
  offline: { icon: CloudOff, color: "text-[#E0E0E0]/25", label: "离线" },
};

export default function SyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());

  useEffect(() => {
    const unsub = onSyncChange(setStatus);
    return unsub;
  }, []);

  if (!isSupabaseConfigured()) return null;

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

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
