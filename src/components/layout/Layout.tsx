import { useEffect, useState, useRef, useCallback } from "react";
import { Outlet, useLocation } from "react-router-dom";
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
//  系统启动画面 — 赛博终端风格
// ═══════════════════════════════════════════════════════════
const BOOT_SEQUENCE = [
  { text: "RIDER WORKBENCH v3.0", delay: 200 },
  { text: "INITIALIZING SYSTEM CORE", delay: 400 },
  { text: "LOADING DATA ENGINES", delay: 300 },
  { text: "CONNECTING TO NEURAL NETWORK", delay: 500 },
  { text: "CALIBRATING AI PREDICTION", delay: 400 },
  { text: "SYNCING QUANTUM DATABASE", delay: 300 },
  { text: "SYSTEM READY", delay: 200, highlight: true },
];

function BootScreen({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [hide, setHide] = useState(false);

  useEffect(() => {
    let currentStep = 0;
    let totalDelay = 0;

    const runSequence = () => {
      const seq = BOOT_SEQUENCE[currentStep];
      if (!seq) {
        // 完成，延迟后隐藏
        setTimeout(() => setHide(true), 300);
        setTimeout(() => onComplete(), 900);
        return;
      }

      setTimeout(() => {
        setStep(currentStep);
        setProgress(((currentStep + 1) / BOOT_SEQUENCE.length) * 100);

        currentStep++;
        if (currentStep < BOOT_SEQUENCE.length) {
          totalDelay += seq.delay;
          runSequence();
        } else {
          // 最后一步
          setTimeout(() => {
            setStep(BOOT_SEQUENCE.length - 1);
            setProgress(100);
            setTimeout(() => setHide(true), 400);
            setTimeout(() => onComplete(), 1000);
          }, seq.delay);
        }
      }, totalDelay);

      totalDelay += seq.delay;
    };

    // 初始延迟
    const initTimer = setTimeout(() => {
      setStep(0);
      setProgress((1 / BOOT_SEQUENCE.length) * 100);
      currentStep = 1;
      totalDelay = BOOT_SEQUENCE[0].delay;
      runSequence();
    }, 300);

    return () => clearTimeout(initTimer);
  }, [onComplete]);

  return (
    <div className={`boot-screen ${hide ? "hide" : ""}`}>
      <div className="boot-logo">RIDER WORKBENCH</div>
      <div className="boot-progress">
        <div className="boot-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="boot-log">
        {step >= 0 && step < BOOT_SEQUENCE.length && (
          <span className={BOOT_SEQUENCE[step].highlight ? "highlight" : ""}>
            [{step >= BOOT_SEQUENCE.length - 1 ? "OK" : "..."}] {BOOT_SEQUENCE[step].text}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Layout() {
  const loadData = useStore((s) => s.loadData);
  const clock = useClock();
  const location = useLocation();
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline">("synced");
  const [pageTransition, setPageTransition] = useState(false);
  const [bootDone, setBootDone] = useState(false);
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    loadData();
  }, []);

  const handleBootComplete = useCallback(() => {
    setBootDone(true);
  }, []);

  // 页面切换过渡动画
  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      setPageTransition(true);
      const timer = setTimeout(() => setPageTransition(false), 200);
      prevPath.current = location.pathname;
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  const triggerSync = useCallback(() => {
    setSyncStatus("syncing");
    setTimeout(() => setSyncStatus("synced"), 2000);
  }, []);

  const [systemStatus] = useState<"正常" | "警告" | "异常">("正常");

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
            <span
              className={`system-status-dot ${
                systemStatus === "警告" ? "warning" : systemStatus === "异常" ? "error" : ""
              }`}
            />
            系统{systemStatus}
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
        style={{
          paddingTop: "44px",
          opacity: pageTransition ? 0.4 : 1,
          transform: pageTransition ? "translateY(8px)" : "translateY(0)",
          transition: "opacity 0.2s ease, transform 0.2s ease",
        }}
      >
        <Outlet />
      </div>

      {/* Navigation */}
      <BottomNav />
      <ToastContainer />
    </div>
  );
}