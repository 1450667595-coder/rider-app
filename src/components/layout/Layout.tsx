import { useEffect, useState, useCallback } from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import ToastContainer from "@/components/shared/Toast";
import useStore from "@/store/useStore";

function useClock() {
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
  return time;
}

// ═══════════════════════════════════════════════════════════
//  系统启动画面 — 极速赛博终端风格
// ═══════════════════════════════════════════════════════════
const BOOT_SEQUENCE = [
  { text: "INITIALIZING SYSTEM", delay: 180 },
  { text: "LOADING DATA ENGINES", delay: 150 },
  { text: "CALIBRATING AI CORE", delay: 180 },
  { text: "SYSTEM READY", delay: 100, highlight: true },
];

function BootScreen({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let mounted = true;
    let total = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    BOOT_SEQUENCE.forEach((seq, i) => {
      const t = setTimeout(() => {
        if (!mounted) return;
        setStep(i + 1);
        setProgress(Math.round(((i + 1) / BOOT_SEQUENCE.length) * 100));
      }, total);
      timers.push(t);
      total += seq.delay;
    });

    const done = setTimeout(() => {
      if (!mounted) return;
      setVisible(false);
      setTimeout(() => { if (mounted) onComplete(); }, 250);
    }, total + 100);
    timers.push(done);

    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
    };
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div className="boot-screen">
      <div className="boot-logo">RIDER WORKBENCH</div>
      <div className="boot-progress">
        <div className="boot-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="boot-log">
        {step > 0 && step <= BOOT_SEQUENCE.length && (
          <span className={BOOT_SEQUENCE[step - 1].highlight ? "highlight" : ""}>
            [{step >= BOOT_SEQUENCE.length ? "OK" : "..."}] {BOOT_SEQUENCE[step - 1].text}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Layout() {
  const loadData = useStore((s) => s.loadData);
  const clock = useClock();
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline">("synced");
  const [bootDone, setBootDone] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const handleBootComplete = useCallback(() => {
    setBootDone(true);
  }, []);

  const triggerSync = useCallback(() => {
    setSyncStatus("syncing");
    setTimeout(() => setSyncStatus("synced"), 2000);
  }, []);

  return (
    <div className="min-h-screen min-h-dvh text-[#E0E0E0] relative">
      {/* 系统启动画面 */}
      {!bootDone && <BootScreen onComplete={handleBootComplete} />}

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
            <span>
              {syncStatus === "synced"
                ? "已同步"
                : syncStatus === "syncing"
                ? "同步中..."
                : "离线"}
            </span>
          </span>
        </div>
        <div className="status-bar-right">
          <span className="status-bar-clock">{clock}</span>
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