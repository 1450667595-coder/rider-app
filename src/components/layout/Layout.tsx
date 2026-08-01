import { useEffect, useState, useRef, useCallback, useMemo } from "react";
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
      const s = now.getSeconds().toString().padStart(2, "0");
      setTime(`${h}:${m}:${s}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function useParallax() {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const handler = () => {
      setOffset(window.scrollY * 0.15);
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
  return offset;
}

// 生成数字雨列数据
function generateRainColumns(count: number) {
  const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789";
  return Array.from({ length: count }, (_, i) => {
    const length = 8 + Math.floor(Math.random() * 20);
    let col = "";
    for (let j = 0; j < length; j++) {
      col += chars[Math.floor(Math.random() * chars.length)];
    }
    const left = (i / count) * 100 + Math.random() * 3;
    const duration = 6 + Math.random() * 10;
    const delay = Math.random() * -15;
    const opacity = 0.3 + Math.random() * 0.5;
    return { text: col, left, duration, delay, opacity };
  });
}

export default function Layout() {
  const loadData = useStore((s) => s.loadData);
  const clock = useClock();
  const parallaxOffset = useParallax();
  const location = useLocation();
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline">("synced");
  const [pageTransition, setPageTransition] = useState(false);
  const prevPath = useRef(location.pathname);

  // 首次加载屏幕
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const loadingLines = useMemo(() => [
    { text: "> 初始化系统核心...", cls: "dim" },
    { text: "> 加载数据模块...", cls: "dim" },
    { text: "> 同步云端数据...", cls: "dim" },
    { text: "> 建立安全连接...", cls: "dim" },
    { text: "> 初始化全息界面...", cls: "dim" },
    { text: "[OK] 系统就绪", cls: "success" },
  ], []);

  // 数字雨数据
  const rainColumns = useMemo(() => generateRainColumns(18), []);

  useEffect(() => {
    loadData();
  }, []);

  // 加载动画序列
  useEffect(() => {
    if (!isLoading) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    loadingLines.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setLoadingStep(i + 1);
      }, 400 + i * 350));
    });
    // 加载完成后隐藏
    timers.push(setTimeout(() => {
      setIsLoading(false);
    }, 400 + loadingLines.length * 350 + 600));
    return () => timers.forEach(clearTimeout);
  }, [isLoading, loadingLines]);

  // 页面切换过渡动画
  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      setPageTransition(true);
      const timer = setTimeout(() => setPageTransition(false), 350);
      prevPath.current = location.pathname;
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  // 模拟数据同步状态（实际项目中可接入真实同步逻辑）
  const triggerSync = useCallback(() => {
    setSyncStatus("syncing");
    setTimeout(() => setSyncStatus("synced"), 2000);
  }, []);

  // 数据健康等级（电池样式：5段）
  const dataHealthLevel = 4; // 0-5，表示数据完整度
  const batterySegments = Array.from({ length: 5 }, (_, i) => i);

  // 系统状态
  const [systemStatus] = useState<"正常" | "警告" | "异常">("正常");

  // 帧率模拟
  const [frameRate] = useState(() => 55 + Math.floor(Math.random() * 15));

  return (
    <div className="min-h-screen min-h-dvh text-[#E0E0E0] relative">
      {/* Scanline overlay */}
      <div className="scanlines-overlay" />

      {/* 视差背景层 */}
      <div
        className="parallax-bg"
        style={{ transform: `translateY(${parallaxOffset}px)` }}
      >
        {/* 数据流装饰 */}
        <div className="data-stream-bg">
          {Array.from({ length: 12 }).map((_, i) => {
            const hexChars = "0123456789ABCDEF";
            const stream = Array.from({ length: 30 }, () =>
              hexChars[Math.floor(Math.random() * 16)]
            ).join(" ");
            const left = (i / 12) * 100 + Math.random() * 4;
            const duration = 8 + Math.random() * 14;
            const delay = Math.random() * -20;
            const opacity = 0.3 + Math.random() * 0.5;
            return (
              <span
                key={i}
                className="data-stream-column"
                style={{
                  left: `${left}%`,
                  "--stream-duration": `${duration}s`,
                  "--stream-delay": `${delay}s`,
                  "--stream-opacity": opacity,
                } as React.CSSProperties}
              >
                {stream}
                {"\n"}
                {stream}
              </span>
            );
          })}
        </div>

        {/* 数字雨背景 */}
        <div className="digital-rain-container">
          {rainColumns.map((col, i) => (
            <span
              key={`rain-${i}`}
              className="digital-rain-column"
              style={{
                left: `${col.left}%`,
                "--rain-duration": `${col.duration}s`,
                "--rain-delay": `${col.delay}s`,
                "--rain-opacity": col.opacity,
              } as React.CSSProperties}
            >
              {col.text}
            </span>
          ))}
        </div>
      </div>

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
          <span className="status-bar-hex">
            <span className="status-bar-pulse-dot" />
            <span>0x7F</span>
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
          <span className="status-bar-data-tag">
            <span style={{ fontSize: "7px" }}>▲</span>
            {frameRate}FPS
          </span>
          <span className="status-bar-sep" />
          <div className="data-health-battery">
            <span style={{ fontSize: "8px" }}>数据</span>
            <div className="battery-segments">
              {batterySegments.map((seg) => (
                <span
                  key={seg}
                  className={`battery-segment ${
                    seg < dataHealthLevel
                      ? dataHealthLevel >= 4
                        ? "filled"
                        : dataHealthLevel >= 2
                        ? "warning"
                        : "danger"
                      : ""
                  }`}
                />
              ))}
            </div>
            <span style={{ fontSize: "8px" }}>{dataHealthLevel * 20}%</span>
          </div>
          <span className="status-bar-sep" />
          <span className="status-bar-clock">{clock}</span>
        </div>
        {/* 状态栏底部扫描线 */}
        <div className="status-bar-scanline" />
      </div>

      {/* HUD top bar */}
      <div
        className="fixed top-0 left-0 right-0 z-20 h-[1px] pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(0,229,255,0.15) 20%, rgba(0,229,255,0.15) 80%, transparent)",
          top: "36px",
        }}
      />

      {/* Content layer — 增强页面过渡 */}
      <div
        className="max-w-lg mx-auto pb-28 relative z-10"
        style={{
          paddingTop: "44px",
          opacity: pageTransition ? 0 : 1,
          transform: pageTransition ? "translateY(12px) scale(0.98)" : "translateY(0) scale(1)",
          filter: pageTransition ? "blur(2px)" : "blur(0)",
          transition: "opacity 0.35s cubic-bezier(0.25, 0.1, 0.25, 1), transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1), filter 0.35s ease",
        }}
      >
        <Outlet />
      </div>

      {/* Navigation layer */}
      <BottomNav />
      <ToastContainer />

      {/* 首次加载屏幕 - 终端效果 */}
      <div className={`cyber-loading-screen${isLoading ? "" : " hidden"}`}>
        <div className="cyber-loading-logo">RIDER_WORKBENCH</div>
        <div className="cyber-loading-terminal">
          <div className="terminal-multiline">
            {loadingLines.map((line, i) => (
              <div
                key={i}
                className="line"
                style={{
                  opacity: i < loadingStep ? 1 : 0,
                  color: line.cls === "success" ? "var(--neon-green)" :
                         line.cls === "dim" ? "rgba(0, 229, 255, 0.4)" :
                         "rgba(0, 229, 255, 0.7)",
                }}
              >
                <span className="prompt" style={{ color: "var(--neon-cyan)", fontWeight: 600 }}>
                  root@cyber:
                </span>
                <span style={{ color: "rgba(0, 229, 255, 0.25)" }}>~$</span>{" "}
                {line.text}
                {i === loadingStep - 1 && i < loadingLines.length - 1 && (
                  <span className="terminal-cursor" />
                )}
              </div>
            ))}
          </div>
          <div className="cyber-loading-bar" style={{ marginTop: "16px" }}>
            <div className="cyber-loading-bar-fill" />
          </div>
        </div>
      </div>
    </div>
  );
}