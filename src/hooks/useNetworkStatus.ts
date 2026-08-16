import { useEffect, useState } from "react";

interface NetworkStatus {
  /** 是否在线（navigator.onLine 初始值 + 事件更新） */
  isOnline: boolean;
  /** 是否为首次加载判断完成（避免 SSR/hydration 闪烁） */
  isReady: boolean;
  /** 预估有效连接类型（仅支持的浏览器有效） */
  effectiveType?: string;
  /** 下行速率 Mbps（仅支持的浏览器有效） */
  downlink?: number;
}

/**
 * 实时检测网络在线/离线状态，配合 PWA Service Worker 使用：
 * - 断网时展示降级 UI，避免用户以为页面卡死
 * - 网络恢复后自动取消提示（关键状态变化可以触发数据同步）
 *
 * 兼容性：
 * - `online/offline` 事件: IE9+ / 所有现代浏览器
 * - `navigator.connection`: Chrome 61+ / Edge 79+ / Opera / Android Browser（Safari 不支持，会是 undefined）
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => ({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    isReady: false,
  }));

  useEffect(() => {
    const conn: any =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    const readConnInfo = (): Partial<NetworkStatus> => {
      if (!conn) return {};
      return {
        effectiveType: typeof conn.effectiveType === "string" ? conn.effectiveType : undefined,
        downlink: typeof conn.downlink === "number" ? conn.downlink : undefined,
      };
    };

    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true, ...readConnInfo() }));
    };
    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, isOnline: false, ...readConnInfo() }));
    };
    const handleConnChange = () => {
      setStatus((prev) => ({ ...prev, ...readConnInfo() }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    conn?.addEventListener?.("change", handleConnChange);

    // 首次同步当前真实状态
    setStatus({
      isOnline: navigator.onLine,
      isReady: true,
      ...readConnInfo(),
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      conn?.removeEventListener?.("change", handleConnChange);
    };
  }, []);

  return status;
}
